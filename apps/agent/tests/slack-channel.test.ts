import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function runSlackChannel(scenario: string) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const channelPath = resolve(import.meta.dir, "../agent/channels/slack.ts");
  const mirrorPath = resolve(
    import.meta.dir,
    "../agent/lib/utils/slack-chat-mirror.ts"
  );
  const controlsPath = resolve(
    import.meta.dir,
    "../agent/lib/utils/slack-controls.ts"
  );
  const postToXPath = resolve(
    import.meta.dir,
    "../agent/lib/utils/slack-post-x.ts"
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
const reactionScenario = scenario.startsWith("working-reaction");
let currentAuth = null;
if (scenario === "chart-failure-with-publish" || scenario === "approval-payload" || scenario === "approval-guest" || scenario === "draft-pr-completion" || reactionScenario) {
  mock.module(runtimePath + "/context/build-callback-context.js", () => ({
    buildCallbackContext: () => ({ session: { id: "session-1", auth: { current: currentAuth, initiator: null } } }),
  }));
}
if (scenario === "draft-pr-completion" || reactionScenario) {
  mock.module(${JSON.stringify(resolve(import.meta.dir, "../agent/lib/utils/chat-mirror.ts"))}, () => ({
    mirrorToolResult: async () => {}, mirrorSessionStatus: async () => {},
    mirrorAssistantDelta: async () => {}, mirrorToolApprovals: async () => {},
  }));
}
process.env.SLACK_AGENT_SIGNING_SECRET = "fixture-signing-secret";
const installations = [
  { slackTeamId: "T-install", organizationId: "org-install", enabled: true, allowedChannelIds: scenario === "owner-policy" || scenario === "working-reaction-blocked" ? ["C-other"] : null, botToken: "fixture-install" },
  { slackTeamId: "T-actor", organizationId: "org-actor", enabled: true, allowedChannelIds: null, botToken: "fixture-actor" },
];
mock.module("@notra/ai/integrations/slack-workspace", () => ({
  getEnabledSlackIntegrations: async () => installations,
  getSlackIntegrationByTeamId: async (teamId) => installations.find((row) => row.slackTeamId === teamId) ?? null,
  getSlackIntegrationBotToken: (row) => row.botToken,
  disableSlackIntegrationByTeamId: async () => {},
  postSlackNotification: async () => {},
}));
mock.module("@notra/ai/billing/chat-billing", () => ({
  checkChatBilling: async () => ({ allowed: true, mode: "ai_credits", chargeAiCredits: true, useMarkup: false, balanceRemaining: 50 }),
}));
const redisStore = new Map();
const redisSets = new Map();
mock.module("@notra/ai/utils/redis", () => ({ redis: {
  get: async (key) => redisStore.get(key) ?? null,
  set: async (key, value, options) => {
    if (options?.xx && !redisStore.has(key)) return null;
    redisStore.set(key, value);
    return "OK";
  },
  getdel: async (key) => { const value = redisStore.get(key) ?? null; redisStore.delete(key); return value; },
  sadd: async (key, ...members) => { const set = redisSets.get(key) ?? new Set(); members.forEach((member) => set.add(member)); redisSets.set(key, set); return members.length; },
  smembers: async (key) => [...(redisSets.get(key) ?? [])],
  srem: async (key, ...members) => { members.forEach((member) => redisSets.get(key)?.delete(member)); return members.length; },
  expire: async () => 1,
} }));
const transcribed = [];
const charged = [];
let failTranscription = () => false;
if (scenario === "voice-reply") {
  mock.module("@notra/ai/billing/zdr", () => ({ resolveOrganizationZdrMode: async () => "required" }));
  const autumnModule = await import("@notra/ai/billing/autumn");
  mock.module("@notra/ai/billing/autumn", () => ({ ...autumnModule, allowUnmeteredAiInDevelopment: false, autumn: { track: async (input) => { charged.push(input); } } }));
  const posthog = await import("@notra/posthog/server");
  mock.module("@notra/posthog/server", () => ({ ...posthog, captureServerEvent: () => {}, flushPostHogServer: async () => {} }));
  const ai = await import("ai");
  mock.module("ai", () => ({ ...ai, experimental_transcribe: async (input) => {
    transcribed.push(input);
    if (failTranscription(transcribed.length)) throw new Error("gateway down");
    return { text: " Draft a LinkedIn post about the launch ", durationInSeconds: 30 };
  } }));
}
const linkedLookups = [];
mock.module("@notra/tools/utils/social-accounts", () => ({
  isTwitterPublishConfigured: () => true,
  getLinkedTwitterAccounts: async (organizationId) => {
    linkedLookups.push(organizationId);
    return [{ id: "acct-" + organizationId, username: organizationId + "-x" }, { id: "alt-" + organizationId, username: organizationId + "-alt" }];
  },
}));
const published = [];
mock.module("@notra/tools/utils/social-publish", () => ({
  publishTwitterPost: (params) => Effect.sync(() => { published.push(params); return { postUrl: "https://x.com/example/status/1", confirmed: true }; }),
}));
mock.module("@notra/db/drizzle", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ slug: "example" }] }) }) }),
  query: { posts: { findFirst: async () => ({ markdown: "Saved tweet" }) } },
} }));
let enterMirror;
let releaseMirror;
const mirrorEntered = new Promise((resolve) => { enterMirror = resolve; });
const mirrorReleased = new Promise((resolve) => { releaseMirror = resolve; });
mock.module(${JSON.stringify(mirrorPath)}, () => ({ mirrorPublicSlackThread: () => Effect.promise(async () => {
  if (scenario === "leave-race" || scenario === "initial-status") { enterMirror(); await mirrorReleased; }
  return null;
}) }));
const outbound = [];
const ephemerals = () => outbound.filter((call) => call.url.endsWith("chat.postEphemeral")).map((call) => call.body.markdown_text);
globalThis.fetch = async (url, init) => {
  outbound.push({ url: String(url), raw: String(init.body), authorization: new Headers(init.headers).get("authorization"), body: Object.fromEntries(new URLSearchParams(String(init.body))) });
  const name = new URL(String(url)).pathname.split("/").at(-1);
  if (new URL(String(url)).hostname === "files.slack.com") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/webm" } });
  if (scenario === "working-reaction-errors" && name === "reactions.add") return Response.json({ ok: false, error: "missing_scope" });
  if (scenario === "working-reaction-errors" && name === "reactions.remove") throw new Error("network down");
  if (name === "conversations.info") return Response.json({ ok: true, channel: { id: "C-room", is_private: false } });
  if (name === "conversations.replies") return Response.json({ ok: true, messages: [{ ts: "1.5", user: "U-other", text: "Prior topic" }] });
  return Response.json({ ok: true, ts: "posted-message" });
};
const { createSession } = await import(runtimePath + "/channel/session.js");
const { createChannelAddress } = await import(runtimePath + "/channel/channel-address.js");
let owner = "original-session";
let rejectNextSend = false;
let resets = 0;
const exactSends = [];
const created = [];
let addressSends = 0;
const continuationSends = [];
const runtime = {
  resolveContinuation: async () => owner ? { sessionId: owner } : undefined,
  dispatchSession: async ({ sessionId, command }) => {
    if (command.kind === "send") exactSends.push({ sessionId, command });
    if (sessionId !== owner || (command.kind === "send" && rejectNextSend && !(rejectNextSend = false))) return { status: "session_not_active" };
    if (command.kind === "reset") { resets++; owner = undefined; return { status: "reset", previousSessionId: sessionId }; }
    return { status: "accepted", sessionId, deliveryId: "fixture-delivery" };
  },
  dispatchContinuation: async ({ command }) => {
    addressSends++;
    continuationSends.push(command);
    return owner ? { status: "accepted", sessionId: owner, deliveryId: "fixture-delivery" } : { status: "session_not_active" };
  },
  createSession: async (input) => { created.push(input); owner = "replacement-session"; return { sessionId: owner }; },
};
const originalSession = createSession(owner, runtime);
const address = createChannelAddress({ channelName: "slack", continuationToken: "C-room:1.0", adapter: { kind: "slack", state: {} }, runtime });
const { default: channel } = await import(${JSON.stringify(channelPath)});
const { handleSlackControl } = await import(${JSON.stringify(controlsPath)});
const { buildSlackBinding } = await import(runtimePath + "/public/channels/slack/api.js");
const binding = buildSlackBinding({ botToken: "fixture-install", channelId: "C-room", threadTs: "1.0", installationTeamId: "T-install", teamId: "T-actor" });
let eventId = 0;
const tasks = [];
const args = {
  from: () => address,
  resolveSession: async () => owner ? createSession(owner, runtime) : undefined,
  waitUntil: (task) => tasks.push(task), params: {}, requestIp: null,
};
async function request(payload, interactivity = false) {
  const body = interactivity ? new URLSearchParams({ payload: JSON.stringify(payload) }).toString() : JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = "v0=" + createHmac("sha256", "fixture-signing-secret").update("v0:" + timestamp + ":" + body).digest("hex");
  const response = await channel.routes[0].handler(new Request("http://localhost/eve/v1/slack", {
    method: "POST", body, headers: { "content-type": interactivity ? "application/x-www-form-urlencoded" : "application/json", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature },
  }), args);
  assert.equal(response.status, 200);
}
async function message(text, mention = false, extra = {}) {
  await request({ type: "event_callback", team_id: "T-install", api_app_id: "A-notra", event_id: "event-" + (++eventId), authorizations: [{ is_bot: true, team_id: "T-install", user_id: "U-notra" }],
    event: { type: mention ? "app_mention" : "message", channel: "C-room", ...(scenario === "initial-status" ? {} : { thread_ts: "1.0" }), ts: "2." + eventId, user: "U-human", text, ...extra } });
}
const reactionCalls = (method) => outbound.filter((call) => call.url.endsWith("/" + method)).map((call) => call.body);
const eyes = (ts) => ({ channel: "C-room", timestamp: ts, name: "eyes" });
const redisMembers = async () => [...redisSets.values()].flatMap((set) => [...set]);
if (scenario === "draft-pr-completion") {
  for (const isError of [false, true]) {
   for (const order of ["draft-first", "pr-first"]) {
    const messages = [];
    const state = { installationTeamId: "T-install" };
    const eventChannel = { state, thread: { post: async (text) => messages.push(text) } };
    const pr = {
      turnId: "turn-1", status: "completed",
      result: { kind: "tool-result", toolName: "create_content_pull_request", callId: "call-1", output: {}, isError },
    };
    const draft = {
      turnId: "turn-1", status: "completed",
      result: { kind: "tool-result", toolName: "create_linkedin_post", callId: "draft-1", output: {}, isError: false },
    };
    for (const result of order === "draft-first" ? [draft, pr] : [pr, draft]) {
      await channel.adapter["action.result"](result, eventChannel);
    }
    await channel.adapter["message.completed"]({ turnId: "turn-1", finishReason: "tool-calls", message: "" }, eventChannel);
    assert.deepEqual(state.notraContentPullRequestTurnIds, ["turn-1"]);
    const text = isError ? "The draft was saved, but PR creation failed." : "Draft PR: https://github.com/example/repo/pull/42";
    await channel.adapter["message.completed"]({ turnId: "turn-1", finishReason: "stop", message: text }, eventChannel);
    assert.deepEqual(messages, [text]);
    assert.deepEqual(state.notraContentPullRequestTurnIds, []);
    await channel.adapter["action.result"]({ ...draft, turnId: "turn-2" }, eventChannel);
    await channel.adapter["message.completed"]({ turnId: "turn-2", finishReason: "stop", message: "Draft text" }, eventChannel);
    assert.equal(messages.at(-1), "Saved as a draft.");
   }
  }
} else if (scenario === "draft-approval") {
  mock.module("@notra/ai/utils/post-service", () => ({
    ensureChatPostCollection: async () => "collection-1",
    createPostRecord: async () => ({ postId: "saved-post", deduplicated: false }),
  }));
  const { createCreatePostTool } = await import("@notra/tools/assistant/create-post");
  for (const type of ["blog_post", "changelog", "twitter_post", "linkedin_post", "investor_update"]) {
    const tool = createCreatePostTool(type);
    assert.equal(tool.approval, undefined);
    const result = await tool.execute({ title: "A draft", markdown: "Draft body", slug: "a-draft" }, {
      session: { id: "session-1", turn: { id: "turn-1" }, auth: { current: { attributes: { organizationId: "org-install", surface: "standalone-chat" } } } },
    });
    assert.equal(result.postId, "saved-post");
    assert.equal(result.status, "created");
  }
} else if (scenario === "approval-payload" || scenario === "approval-guest") {
  const { handleSlackInputRequested } = await import(${JSON.stringify(resolve(import.meta.dir, "../agent/lib/utils/slack-input-request.ts"))});
  const { defaultInputRequestedHandler } = await import(runtimePath + "/public/channels/slack/defaults.js");
  const details = "Large blog draft & Unicode ü\\n".repeat(3000);
  const data = { turnId: "turn-1", requests: [{
    requestId: "req-1", kind: "tool-approval", display: "confirmation", prompt: "Approve publishing?",
    action: { kind: "tool-call", toolName: "publish_content", callId: "call-1", input: { markdown: details } },
    options: [{ id: "approve", label: "Approve" }, { id: "deny", label: "Cancel" }],
  }] };
  const eventChannel = { ...binding, state: { installationTeamId: "T-install", channelId: "C-room" } };
  const deliver = defaultInputRequestedHandler();
  await handleSlackInputRequested(data, eventChannel, (requests) => deliver(requests, eventChannel, { session: { auth: { current: null } } }));
  const posts = outbound.filter((call) => call.url.endsWith("chat.postMessage"));
  assert(posts.length >= 2);
  const controls = posts.find((call) => call.body.blocks?.includes("eve_input:"));
  assert(controls);
  assert(!controls.body.blocks.includes("Large blog draft"));
  assert(Buffer.byteLength(controls.raw) < 5000);
  assert(posts.some((call) => call.body.blocks?.includes("Large blog draft")));
  const blocks = JSON.parse(controls.body.blocks);
  const buttons = blocks.flatMap((block) => block.elements ?? block.actions ?? []).filter((element) => element.type === "button");
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    await request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: scenario === "approval-guest" ? "T-actor" : "T-install" },
      channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0", blocks }, actions: [button] }, true);
  }
  await Promise.all(tasks);
  if (scenario === "approval-guest") {
    assert.equal(continuationSends.length, 0);
    assert.equal(ephemerals().length, 2);
    assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
  } else {
  assert.equal(continuationSends.length, 2);
  assert(continuationSends.every((command) => JSON.stringify(command).includes("req-1")));
  assert(JSON.stringify(continuationSends[0]).includes("approve"));
  assert(JSON.stringify(continuationSends[1]).includes("deny"));
  assert.equal(ephemerals().length, 0);
  }
} else if (scenario === "saved-tweet-publish") {
  const { buildPostToXConfirmCard } = await import(${JSON.stringify(postToXPath)});
  const { offerSavedTweetPublishing } = await import(${JSON.stringify(resolve(import.meta.dir, "../agent/lib/utils/slack-input-request.ts"))});
  await offerSavedTweetPublishing({ ...binding, state: { installationTeamId: "T-install" } }, "org-install", "saved-post", "saved-call", "U-human");
  assert.equal(JSON.parse(redisStore.get("slack:post-x:saved-call")).requestedBy, "U-human");
  const draftPosts = outbound.filter((call) => call.url.endsWith("chat.postMessage"));
  assert.equal(draftPosts.length, 2);
  assert(JSON.stringify(draftPosts[0].body).includes("Saved tweet"));
  assert(!draftPosts[1].body.blocks.includes("Saved tweet"));
  assert(draftPosts[1].body.blocks.includes("notra_post_x_confirm:"));
  assert(!draftPosts[1].body.blocks.includes("eve_input:"));
  const click = (action, userId = "U-human") => request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: userId, team_id: "T-install" },
    channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [action] }, true);
  const confirm = { action_id: "notra_post_x_confirm:saved-call", value: JSON.stringify({ callId: "saved-call", username: "notra" }) };
  await click(confirm, "U-other");
  await click(confirm);
  await click({
    action_id: "notra_post_x_account:saved-call",
    type: "static_select",
    selected_option: { value: JSON.stringify({ callId: "saved-call", accountId: "acct-other", username: "other" }) },
  }, "U-other");
  await Promise.all(tasks);
  assert.equal(published.length, 0);
  assert.notEqual(JSON.parse(redisStore.get("slack:post-x:saved-call")).accountId, "acct-other");
  const card = buildPostToXConfirmCard({ callId: "saved-call", username: "notra", accounts: [] });
  const button = card.blocks.at(-1).elements[0];
  assert(button.action_id.startsWith("notra_post_x_publish:"));
  // Teammates can see the card, but only the person who asked can post it.
  await click(button, "U-other");
  await Promise.all(tasks);
  assert.equal(published.length, 0);
  assert.equal(ephemerals().length, 3);
  assert(ephemerals().every((text) => text.includes("Only the person who asked")));
  await click(button);
  await Promise.all(tasks);
  await click(button);
  await Promise.all(tasks);
  assert.equal(published.length, 1);
  assert.equal(published[0].content, "Saved tweet");
  assert.equal(exactSends.length, 0);
} else if (scenario === "initial-status") {
  owner = undefined;
  await message("<@U-notra> chart our GEO performance", true);
  await mirrorEntered;
  const statuses = outbound.filter((call) => call.url.endsWith("assistant.threads.setStatus"));
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].authorization, "Bearer fixture-install");
  assert.equal(statuses[0].body.channel_id, "C-room");
  assert.equal(statuses[0].body.thread_ts, "2.1");
  assert.equal(statuses[0].body.status, "On it…");
  assert.equal(created.length, 0);
  releaseMirror();
  await Promise.all(tasks);
  assert.equal(created.length, 1);
} else if (scenario === "chart-failure-with-publish") {
  for (const outcome of ["publish", "draft"]) {
    const messages = [];
    const state = {
      teamId: "T-install",
      notraChartFailureTurnId: "turn-1",
      ...(outcome === "publish" ? {
        notraPostToXTurnId: "turn-1",
        notraPostToXOutcome: { turnId: "turn-1", postUrl: "https://x.com/example/status/123", failed: false, confirmed: true },
      } : { notraDraftCompletion: { turnId: "turn-1", count: 1 } }),
    };
    await channel.adapter["message.completed"](
      { turnId: "turn-1", finishReason: "stop", message: "Done" },
      { state, thread: { post: async (text) => messages.push(text) } },
    );
    assert.equal(messages.length, 2);
    assert(messages[0].includes("couldn't render or upload"));
    assert(messages[1].includes(outcome === "publish" ? "Posted to X:" : "Saved as a draft."));
    assert.equal(state.notraChartFailureTurnId, undefined);
    assert.equal(state.notraPostToXTurnId, undefined);
    assert.equal(state.notraDraftCompletion, undefined);
  }
} else if (scenario === "owner-policy" || scenario === "external-actor" || scenario === "member-actor") {
  const actorTeamId = { "owner-policy": "T-actor", "external-actor": "T-unknown", "member-actor": "T-install" }[scenario];
  for (const actionId of ["notra_stop_turn", "notra_leave_thread"]) {
    await request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: actorTeamId },
      channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [{ action_id: actionId, value: JSON.stringify({ sessionId: "original-session", turnId: "turn-0" }) }] }, true);
  }
  await Promise.all(tasks);
  assert.equal(resets, scenario === "member-actor" ? 1 : 0);
  assert(outbound.every((call) => call.authorization === "Bearer fixture-install"));
  if (scenario === "external-actor") {
    assert.equal(outbound.length, 2);
    assert.equal(ephemerals().length, 2);
    assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
  } else {
    assert.equal(ephemerals().length, 0);
  }
} else if (scenario === "post-x-guest") {
  redisStore.set("slack:post-x:call-install", JSON.stringify({ organizationId: "org-install", accountId: "acct-org-install", username: "org-install-x", text: "Hello" }));
  const click = (action) => request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-guest", team_id: "T-actor" },
    channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [action] }, true);
  await click({ action_id: "notra_post_x_confirm:req-1", value: JSON.stringify({ callId: "call-install", username: "x" }) });
  await click({ action_id: "notra_post_x_account:call-install", selected_option: { value: JSON.stringify({ callId: "call-install", accountId: "alt-org-install", username: "org-install-alt" }) } });
  await click({ action_id: "notra_post_x_publish:call-install", value: "call-install" });
  await click({ action_id: "notra_post_x_cancel:call-install", value: "call-install" });
  await Promise.all(tasks);
  assert.deepEqual(linkedLookups, []);
  assert.equal(published.length, 0);
  assert.equal(JSON.parse(redisStore.get("slack:post-x:call-install")).accountId, "acct-org-install");
  assert.equal(outbound.filter((call) => !call.url.endsWith("chat.postEphemeral")).length, 0);
  assert.equal(ephemerals().length, 4);
  assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
} else if (scenario === "post-x-slack-connect") {
  const pending = (organizationId) => JSON.stringify({ organizationId, accountId: "acct-" + organizationId, username: organizationId + "-x", text: "Hello" });
  redisStore.set("slack:post-x:call-install", pending("org-install"));
  redisStore.set("slack:post-x:call-actor", pending("org-actor"));
  const click = (action) => request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: "T-install" },
    channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [action] }, true);
  for (const callId of ["call-install", "call-actor"]) {
    await click({ action_id: "notra_post_x_confirm:req-1", value: JSON.stringify({ requestId: "req-1", callId, username: "x" }) });
  }
  await click({ action_id: "notra_post_x_account:call-actor", selected_option: { value: JSON.stringify({ callId: "call-actor", accountId: "acct-install", username: "install" }) } });
  await Promise.all(tasks);
  assert.deepEqual(linkedLookups, ["org-install"]);
  const cards = outbound.filter((call) => call.url.endsWith("chat.postMessage"));
  assert.equal(cards.length, 1);
  assert(cards[0].raw.includes("org-install-alt"));
  assert(!cards[0].raw.includes("org-actor"));
  assert.equal(JSON.parse(redisStore.get("slack:post-x:call-actor")).accountId, "acct-org-actor");
} else if (scenario === "post-x-once") {
  const { publishPendingPostToX } = await import(${JSON.stringify(postToXPath)});
  redisStore.set("slack:post-x:call-1", JSON.stringify({ organizationId: "org-install", accountId: "acct-1", username: "notra", text: "Hello" }));
  const outcomes = await Promise.all([publishPendingPostToX("call-1", "turn-1"), publishPendingPostToX("call-1", "turn-1")]);
  assert.equal(published.length, 1);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(await publishPendingPostToX("call-1", "turn-2"), undefined);
  assert.equal(published.length, 1);
  // An account switch that read the post before the claim must not revive it.
  const { savePendingPostToX } = await import(${JSON.stringify(postToXPath)});
  assert.equal(await savePendingPostToX("call-1", { organizationId: "org-install", accountId: "acct-2", username: "other", text: "Hello" }, { onlyIfExists: true }), false);
  assert(!redisStore.has("slack:post-x:call-1"));
} else if (scenario === "leave-race") {
  await message("follow-up");
  await mirrorEntered;
  await handleSlackControl("leave", { thread: binding.thread, resolveSession: async () => originalSession });
  releaseMirror();
  await Promise.all(tasks);
  assert.equal(resets, 1);
  assert.equal(created.length, 0);
  assert.equal(addressSends, 0);
  assert.equal(exactSends.length, 1);
  assert.equal(exactSends[0].sessionId, "original-session");
  assert.equal(owner, undefined);
} else if (scenario === "reply") {
  await message("follow-up");
  await Promise.all(tasks);
  assert.equal(addressSends, 0);
  assert.equal(exactSends.length, 1);
  const content = JSON.stringify(exactSends[0].command.payload.message);
  assert(content.includes("follow-up"));
  assert(content.includes("Prior topic"));
  assert(content.includes("U-human"));
  assert.equal(exactSends[0].command.auth.attributes.organizationId, "org-install");
} else if (scenario === "working-reaction") {
  const eventChannel = { ...binding, state: { installationTeamId: "T-install", channelId: "C-room" } };
  owner = undefined;
  // Ignored senders and control messages never get the reaction.
  await message("<@U-notra> hi from elsewhere", true, { user_team: "T-unknown" });
  await message("<@U-notra> stop", true);
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add"), []);
  // A mention that starts a turn is reacted to and carries its ts into the turn.
  await message("<@U-notra> draft a post", true);
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add"), [eyes("2.3")]);
  assert.equal(created.length, 1);
  assert.equal(created[0].auth.attributes.slackWorkingReactionsKey, "slack:working-reactions:T-install:C-room:1.0");
  currentAuth = created[0].auth;
  await channel.adapter["turn.started"]({ turnId: "turn-1" }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove"), []);
  // Tool-call steps keep the reaction; posting the answer clears it.
  await channel.adapter["message.completed"]({ turnId: "turn-1", finishReason: "tool-calls", message: "Looking that up" }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove"), []);
  await channel.adapter["message.completed"]({ turnId: "turn-1", finishReason: "stop", message: "Here's the draft." }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.3")]);
  await channel.adapter["turn.completed"]({ turnId: "turn-1" }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.3")]);
  await channel.adapter["session.waiting"]({}, eventChannel);
  assert.equal(reactionCalls("reactions.remove").length, 1);
  // Two replies delivered together expose only the last one's auth; both
  // reactions still clear when that turn fails.
  await message("follow-up");
  await message("one more thing");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").slice(1), [eyes("2.4"), eyes("2.5")]);
  currentAuth = exactSends[1].command.auth;
  await channel.adapter["turn.started"]({ turnId: "turn-2" }, eventChannel);
  await channel.adapter["turn.failed"]({ turnId: "turn-2", code: "error", message: "boom" }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove").slice(1).map((call) => call.timestamp).sort(), ["2.4", "2.5"]);
  // Stopping a turn clears its reaction; the stop message itself gets none.
  await message("next request");
  await message("stop");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").slice(3), [eyes("2.6")]);
  currentAuth = exactSends[2].command.auth;
  await channel.adapter["turn.started"]({ turnId: "turn-3" }, eventChannel);
  await channel.adapter["turn.cancelled"]({ turnId: "turn-3" }, eventChannel);
  await channel.adapter["session.waiting"]({}, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove").slice(3), [eyes("2.6")]);
  // A reply the session refuses (e.g. after "leave") loses its 👀 right away.
  rejectNextSend = true;
  await message("too late");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").at(-1), eyes("2.8"));
  assert.deepEqual(reactionCalls("reactions.remove").at(-1), eyes("2.8"));
  assert.deepEqual(await redisMembers(), []);
} else if (scenario === "working-reaction-blocked") {
  owner = undefined;
  await message("<@U-notra> draft a post", true);
  await Promise.all(tasks);
  assert.equal(created.length, 0);
  assert.deepEqual(reactionCalls("reactions.add"), []);
} else if (scenario === "working-reaction-errors") {
  const eventChannel = { ...binding, state: { installationTeamId: "T-install", channelId: "C-room" } };
  owner = undefined;
  await message("<@U-notra> draft a post", true);
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add"), [eyes("2.1")]);
  assert.equal(created.length, 1);
  currentAuth = created[0].auth;
  await channel.adapter["turn.started"]({ turnId: "turn-1" }, eventChannel);
  await channel.adapter["message.completed"]({ turnId: "turn-1", finishReason: "stop", message: "Done" }, eventChannel);
  await channel.adapter["turn.completed"]({ turnId: "turn-1" }, eventChannel);
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.1")]);
  assert.deepEqual(await redisMembers(), []);
  assert(outbound.some((call) => call.url.endsWith("chat.postMessage") && call.raw.includes("Done")));
} else if (scenario === "voice-reply") {
  const clip = { subtype: "file_share", files: [{ id: "F-clip", subtype: "slack_audio", name: "audio_message.webm", mimetype: "audio/webm", size: 3, url_private: "https://files.slack.com/files-pri/T-install-F-clip/audio_message.webm" }] };
  await message("", false, clip);
  await Promise.all(tasks);
  assert.equal(transcribed.length, 1);
  assert.equal(transcribed[0].providerOptions.gateway.zeroDataRetention, true);
  assert.equal(outbound.find((call) => call.url.includes("files.slack.com")).authorization, "Bearer fixture-install");
  assert.equal(exactSends.length, 1);
  const content = JSON.stringify(exactSends[0].command);
  assert(content.includes("Transcript:\\\\n\\\\nDraft a LinkedIn post about the launch"));
  assert.deepEqual(charged.map((call) => [call.customerId, call.featureId, call.value, call.properties.audio_seconds]), [["org-install", "ai_credits", 1, 30]]);
  // When one of two clips fails the agent is told part of the message is missing.
  failTranscription = (call) => call === 3;
  const second = { ...clip.files[0], id: "F-clip-2" };
  await message("", false, { ...clip, files: [clip.files[0], second] });
  await Promise.all(tasks);
  assert.equal(exactSends.length, 2);
  assert(JSON.stringify(exactSends[1].command).includes("1 more voice clip in that message could not be transcribed"));
  assert.equal(charged.length, 2);
  // A voice-only message nobody could transcribe never starts a turn or a charge.
  failTranscription = () => true;
  await message("", false, clip);
  await Promise.all(tasks);
  assert.equal(exactSends.length, 2);
  assert.equal(charged.length, 2);
  assert(outbound.some((call) => call.url.endsWith("chat.postMessage") && decodeURIComponent(call.raw.replaceAll("+", " ")).includes("transcribe that voice message")));
} else if (scenario === "mention-after-leave") {
  await handleSlackControl("leave", { thread: binding.thread, resolveSession: async () => originalSession });
  await message("unmentioned follow-up");
  await Promise.all(tasks);
  assert.equal(created.length, 0);
  await message("<@U-notra> start again", true);
  await Promise.all(tasks);
  assert.equal(created.length, 1);
  assert.equal(owner, "replacement-session");
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

describe("Slack native channel boundaries", () => {
  test("saving a draft does not hide a subsequent PR link or PR failure", () =>
    runSlackChannel("draft-pr-completion"));
  test("content drafts save without approval", () =>
    runSlackChannel("draft-approval"));
  test("large approval details stay outside button callbacks and both decisions are delivered", () =>
    runSlackChannel("approval-payload"));
  test("Slack Connect guests cannot answer approvals", () =>
    runSlackChannel("approval-guest"));
  test("saved tweets only publish after the requester confirms, at most once", () =>
    runSlackChannel("saved-tweet-publish"));
  test("the first top-level mention sets native status before preparing the session", () =>
    runSlackChannel("initial-status"));
  test("a chart failure does not hide successful publishing or draft creation", () =>
    runSlackChannel("chart-failure-with-publish"));
  test("Slack Connect checks the installation policy, not the actor policy", () =>
    runSlackChannel("owner-policy"));
  test("Slack Connect guests cannot use the thread controls", () =>
    runSlackChannel("external-actor"));
  test("installing workspace members can use the thread controls", () =>
    runSlackChannel("member-actor"));
  test("Post to X in Slack Connect only uses the installing organization", () =>
    runSlackChannel("post-x-slack-connect"));
  test("Slack Connect guests cannot confirm, switch, publish or cancel Post to X", () =>
    runSlackChannel("post-x-guest"));
  test("a pending Post to X publishes at most once", () =>
    runSlackChannel("post-x-once"));
  test("an in-flight ordinary reply cannot recreate a thread after Leave", () =>
    runSlackChannel("leave-race"));
  test("pinned replies preserve speaker attribution and thread context", () =>
    runSlackChannel("reply"));
  test("voice messages reach the agent as a transcript", () =>
    runSlackChannel("voice-reply"));
  test("unmentioned replies stay ignored after Leave and a mention restarts the thread", () =>
    runSlackChannel("mention-after-leave"));
  test("👀 marks a message while its turn runs and clears when it ends", () =>
    runSlackChannel("working-reaction"));
  test("messages in a disallowed channel get no 👀", () =>
    runSlackChannel("working-reaction-blocked"));
  test("reaction API failures don't block or break the turn", () =>
    runSlackChannel("working-reaction-errors"));
});
