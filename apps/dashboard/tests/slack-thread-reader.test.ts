import { afterEach, expect, spyOn, test } from "bun:test";

import { SLACK_RELAY_EVENT_TYPE } from "@notra/ai/constants/chat";

import { readSlackThread } from "@/lib/slack/thread-reader";

const TARGET = { teamId: "T1", channelId: "C1", threadTs: "100.0" };

let fetchSpy: ReturnType<typeof spyOn> | undefined;

function slackApi(responses: Record<string, unknown>) {
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
    input: string | URL | Request
  ) => {
    const url = new URL(String(input));
    const method = url.pathname.split("/").at(-1) ?? "";
    let key = method;
    if (method === "users.info") {
      key = `users.info:${url.searchParams.get("user")}`;
    } else if (url.searchParams.get("cursor")) {
      key = `${method}:${url.searchParams.get("cursor")}`;
    }
    return Response.json(responses[key] ?? { ok: false, error: "unknown" });
  }) as typeof fetch);
}

const PUBLIC_CHANNEL = { ok: true, channel: { is_private: false } };
const NOTRA_BOT = { ok: true, user_id: "UNOTRA", bot_id: "BNOTRA" };

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
});

test("reads people, Notra and relayed messages, and leaves other bots out", async () => {
  slackApi({
    "conversations.info": PUBLIC_CHANNEL,
    "auth.test": NOTRA_BOT,
    "conversations.replies": {
      ok: true,
      messages: [
        {
          ts: "100.0",
          user: "UALEX",
          text: "<@UNOTRA> summarize <https://example.com/pr/1|PR 1> for <@USAM>",
        },
        {
          ts: "101.0",
          user: "UNOTRA",
          bot_id: "BNOTRA",
          text: "On it &amp; done.",
        },
        { ts: "102.0", bot_id: "BGITHUB", text: "CI passed" },
        {
          ts: "103.0",
          user: "UNOTRA",
          bot_id: "BNOTRA",
          text: "*Jan:* shorter please",
          metadata: {
            event_type: SLACK_RELAY_EVENT_TYPE,
            event_payload: { user_name: "Jan", text: "shorter please" },
          },
        },
        { ts: "104.0", user: "USAM", text: "  " },
      ],
    },
    "users.info:UALEX": {
      ok: true,
      user: {
        profile: {
          display_name: "Alex",
          image_72: "https://avatars.slack-edge.com/alex.png",
        },
      },
    },
    "users.info:USAM": { ok: true, user: { real_name: "Sam Okafor" } },
  });

  const messages = await readSlackThread("xoxb-test", TARGET);

  expect(messages).toEqual([
    {
      id: "slack:C1:100.0",
      role: "user",
      parts: [
        {
          type: "text",
          text: "@Notra summarize [PR 1](https://example.com/pr/1) for @Sam Okafor",
        },
      ],
      metadata: {
        slackAuthor: {
          userId: "UALEX",
          name: "Alex",
          image: "https://avatars.slack-edge.com/alex.png",
        },
      },
    },
    {
      id: "slack:C1:101.0",
      role: "assistant",
      parts: [{ type: "text", text: "On it & done." }],
    },
    {
      id: "slack:C1:103.0",
      role: "user",
      parts: [{ type: "text", text: "shorter please" }],
      metadata: { slackAuthor: { userId: "UNOTRA", name: "Jan" } },
    },
  ]);
});

test("keeps a thread from a private channel out of the dashboard", async () => {
  slackApi({
    "conversations.info": { ok: true, channel: { is_private: true } },
    "auth.test": NOTRA_BOT,
    "conversations.replies": {
      ok: true,
      messages: [{ ts: "100.0", user: "UALEX", text: "secret" }],
    },
  });

  expect(await readSlackThread("xoxb-test", TARGET)).toBeNull();
});

test("returns nothing when Slack refuses the thread", async () => {
  slackApi({
    "conversations.info": PUBLIC_CHANNEL,
    "auth.test": NOTRA_BOT,
    "conversations.replies": { ok: false, error: "not_in_channel" },
  });

  expect(await readSlackThread("xoxb-test", TARGET)).toBeNull();
});

test("follows Slack's cursor to read every page of the thread", async () => {
  slackApi({
    "conversations.info": PUBLIC_CHANNEL,
    "auth.test": NOTRA_BOT,
    "conversations.replies": {
      ok: true,
      messages: [
        { ts: "100.0", user: "UNOTRA", bot_id: "BNOTRA", text: "one" },
      ],
      response_metadata: { next_cursor: "page-2" },
    },
    "conversations.replies:page-2": {
      ok: true,
      messages: [
        { ts: "101.0", user: "UNOTRA", bot_id: "BNOTRA", text: "two" },
      ],
      response_metadata: { next_cursor: "" },
    },
  });

  const messages = await readSlackThread("xoxb-test", TARGET);

  expect(messages?.map((message) => message.id)).toEqual([
    "slack:C1:100.0",
    "slack:C1:101.0",
  ]);
});
