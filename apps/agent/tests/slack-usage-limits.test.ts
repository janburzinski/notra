import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function runSlackUsageScenario(scenario: string) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const channelPath = resolve(import.meta.dir, "../agent/channels/slack.ts");
  const mirrorPath = resolve(
    import.meta.dir,
    "../agent/lib/utils/slack-chat-mirror.ts"
  );
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Effect } from "effect";
const scenario = ${JSON.stringify(scenario)};
const runtimePath = ${JSON.stringify(runtime)};
process.env.SLACK_AGENT_SIGNING_SECRET = "fixture-signing-secret";
const installation = { slackTeamId: "T-install", organizationId: "org-install", enabled: true, allowedChannelIds: null, botToken: "fixture-install" };
mock.module("@notra/ai/integrations/slack-workspace", () => ({
  getEnabledSlackIntegrations: async () => [installation],
  getSlackIntegrationByTeamId: async (teamId) => teamId === installation.slackTeamId ? installation : null,
  getSlackIntegrationBotToken: (row) => row.botToken,
  disableSlackIntegrationByTeamId: async () => {},
  postSlackNotification: async () => {},
}));
mock.module("@notra/db/drizzle", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ slug: "example" }] }) }) }),
} }));
mock.module(${JSON.stringify(mirrorPath)}, () => ({ mirrorPublicSlackThread: () => Effect.succeed(null) }));
const billingCalls = [];
mock.module("@notra/ai/billing/chat-billing", () => ({
  checkChatBilling: async (organizationId) => {
    billingCalls.push(organizationId);
    if (scenario === "billing-error") throw new Error("Autumn is down");
    if (scenario === "out-of-credits") return { allowed: false, mode: "ai_credits", chargeAiCredits: false, useMarkup: false, balanceRemaining: 0 };
    return { allowed: true, mode: "ai_credits", chargeAiCredits: true, useMarkup: true, balanceRemaining: 50 };
  },
}));
const rateLimitCalls = [];
mock.module("@notra/ai/utils/chat-generation-rate-limit", () => ({
  consumeChatGenerationRateLimit: async (organizationId, userId) => {
    rateLimitCalls.push([organizationId, userId]);
    const success = scenario !== "rate-limited";
    return { success, limit: 20, remaining: success ? 19 : 0, reset: Date.now() + 60000 };
  },
}));
const outbound = [];
globalThis.fetch = async (url, init) => {
  outbound.push({ name: new URL(String(url)).pathname.split("/").at(-1), body: Object.fromEntries(new URLSearchParams(String(init.body))) });
  const name = new URL(String(url)).pathname.split("/").at(-1);
  if (name === "conversations.info") return Response.json({ ok: true, channel: { id: "C-room", is_private: false } });
  if (name === "conversations.replies") return Response.json({ ok: true, messages: [] });
  return Response.json({ ok: true, ts: "posted-message" });
};
const { createSession } = await import(runtimePath + "/channel/session.js");
const { createChannelAddress } = await import(runtimePath + "/channel/channel-address.js");
const threaded = scenario !== "allowed-mention";
let owner = threaded ? "original-session" : undefined;
const exactSends = [];
const created = [];
const runtime = {
  resolveContinuation: async () => owner ? { sessionId: owner } : undefined,
  dispatchSession: async ({ sessionId, command }) => {
    if (command.kind === "send") exactSends.push(command);
    return { status: "accepted", sessionId, deliveryId: "fixture-delivery" };
  },
  dispatchContinuation: async () => ({ status: "session_not_active" }),
  createSession: async (input) => { created.push(input); owner = "new-session"; return { sessionId: owner }; },
};
const address = createChannelAddress({ channelName: "slack", continuationToken: "C-room:1.0", adapter: { kind: "slack", state: {} }, runtime });
const { default: channel } = await import(${JSON.stringify(channelPath)});
const tasks = [];
const args = {
  from: () => address,
  resolveSession: async () => owner ? createSession(owner, runtime) : undefined,
  waitUntil: (task) => tasks.push(task), params: {}, requestIp: null,
};
const body = JSON.stringify({ type: "event_callback", team_id: "T-install", api_app_id: "A-notra", event_id: "event-1", authorizations: [{ is_bot: true, team_id: "T-install", user_id: "U-notra" }],
  event: threaded
    ? { type: "message", channel: "C-room", thread_ts: "1.0", ts: "2.1", user: "U-human", text: "follow-up" }
    : { type: "app_mention", channel: "C-room", ts: "2.1", user: "U-human", text: "<@U-notra> hello" } });
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = "v0=" + createHmac("sha256", "fixture-signing-secret").update("v0:" + timestamp + ":" + body).digest("hex");
const response = await channel.routes[0].handler(new Request("http://localhost/eve/v1/slack", {
  method: "POST", body, headers: { "content-type": "application/json", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature },
}), args);
assert.equal(response.status, 200);
await Promise.all(tasks);

assert.deepEqual(billingCalls, ["org-install"]);
assert.deepEqual(rateLimitCalls, [["org-install", "slack:T-install:U-human"]]);
const ephemerals = outbound.filter((call) => call.name === "chat.postEphemeral");
const turns = [...exactSends.map((command) => command.auth), ...created.map((input) => JSON.stringify(input))];
if (scenario === "out-of-credits" || scenario === "rate-limited") {
  assert.equal(turns.length, 0);
  assert.equal(ephemerals.length, 1);
  assert.equal(ephemerals[0].body.user, "U-human");
  const text = JSON.stringify(ephemerals[0].body);
  assert(text.includes(scenario === "out-of-credits" ? "out of AI credits" : "sending messages too quickly"));
  assert(!outbound.some((call) => call.name === "assistant.threads.setStatus" && call.body.status));
} else if (scenario === "allowed-mention") {
  assert.equal(ephemerals.length, 0);
  assert.equal(created.length, 1);
  const input = JSON.stringify(created[0]);
  assert(input.includes('"useMarkup":"true"'));
  assert(input.includes('"chargeAiCredits":"true"'));
} else {
  assert.equal(ephemerals.length, 0);
  assert.equal(exactSends.length, 1);
  const attributes = exactSends[0].auth.attributes;
  assert.equal(attributes.organizationId, "org-install");
  if (scenario === "billing-error") {
    assert.equal(attributes.useMarkup, undefined);
    assert.equal(attributes.chargeAiCredits, undefined);
  } else {
    assert.equal(attributes.useMarkup, "true");
    assert.equal(attributes.chargeAiCredits, "true");
  }
}
`,
    ],
    { cwd: resolve(import.meta.dir, ".."), timeout: 30_000 }
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  expect(result.exitCode).toBe(0);
}

describe("Slack usage limits", () => {
  test("an organization out of AI credits gets a notice instead of a turn", () =>
    runSlackUsageScenario("out-of-credits"));
  test("a rate-limited Slack user gets a notice instead of a turn", () =>
    runSlackUsageScenario("rate-limited"));
  test("an allowed thread reply starts a turn with the dashboard's billing attributes", () =>
    runSlackUsageScenario("allowed"));
  test("an allowed mention starts a session with the dashboard's billing attributes", () =>
    runSlackUsageScenario("allowed-mention"));
  test("a failing credit check lets the turn through", () =>
    runSlackUsageScenario("billing-error"));
});
