import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function runSlackChannel(scenario: string) {
  const runtime = realpathSync(
    resolve(import.meta.dir, "../node_modules/eve/dist/src")
  );
  const channelPath = resolve(import.meta.dir, "../agent/channels/slack.ts");
  const rendererPath = resolve(
    import.meta.dir,
    "../agent/lib/utils/slack-renderer.ts"
  );
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
import { emptySessionView, foldEvents } from "eve/events";
import { renderInteractionBlocks } from "eve/channels/slack";
const scenario = ${JSON.stringify(scenario)};
const runtimePath = ${JSON.stringify(runtime)};
let currentAuth = null;
mock.module(${JSON.stringify(resolve(import.meta.dir, "../agent/lib/utils/chat-mirror.ts"))}, () => ({
  mirrorToolResult: async () => {}, mirrorSessionStatus: async () => {},
  mirrorAssistantDelta: async () => {}, mirrorToolApprovals: async () => {},
}));
process.env.SLACK_AGENT_SIGNING_SECRET = "fixture-signing-secret";
const installations = [
  { slackTeamId: "T-install", organizationId: "org-install", enabled: true, allowedChannelIds: scenario === "owner-policy" || scenario === "working-reaction-blocked" || scenario === "metrics-blocked" ? ["C-other"] : null, botToken: "fixture-install" },
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
const evaluations = [];
let evaluationAvailable = true;
mock.module("@notra/ai/evaluation/client", () => ({ getEvaluationClient: () => ({
  isAvailable: () => scenario === "addressing" && evaluationAvailable,
  tryEvaluate: async (params) => {
    if (scenario !== "addressing" || !evaluationAvailable) return null;
    evaluations.push(params);
    const forNotra = params.state.latestMessage.includes("week before");
    return { answers: { addressedToNotra: { value: forNotra, probability: forNotra ? 0.9 : 0.1 } }, confidence: {}, usage: {}, modelId: "fixture", durationMs: 1 };
  },
}) }));
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
const metricInserts = [];
const metricUpdates = [];
let failMetricWrites = false;
const { PgDialect } = await import("drizzle-orm/pg-core");
const dialect = new PgDialect();
mock.module("@notra/db/drizzle", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ slug: "example" }] }) }) }),
  query: { posts: { findFirst: async () => ({ markdown: "Saved tweet" }) } },
  insert: () => ({ values: (row) => ({ onConflictDoNothing: async () => {
    if (failMetricWrites) throw new Error("metrics database unavailable");
    metricInserts.push(row);
  } }) }),
  update: () => ({ set: (values) => ({ where: async (condition) => {
    if (failMetricWrites) throw new Error("metrics database unavailable");
    metricUpdates.push({ values, params: dialect.sqlToQuery(condition).params });
  } }) }),
} }));
let enterMirror;
let releaseMirror;
const mirrorEntered = new Promise((resolve) => { enterMirror = resolve; });
const mirrorReleased = new Promise((resolve) => { releaseMirror = resolve; });
mock.module(${JSON.stringify(mirrorPath)}, () => ({ mirrorPublicSlackThread: () => Effect.promise(async () => {
  if (scenario === "leave-race" || scenario === "initial-status") { enterMirror(); await mirrorReleased; }
  return null;
}) }));
const tokenTeams = { "Bearer fixture-install": "T-install", "Bearer fixture-actor": "T-actor" };
const outbound = [];
const ephemerals = () => outbound.filter((call) => call.url.endsWith("chat.postEphemeral")).map((call) => call.body.markdown_text);
const slackCalls = () => outbound.filter((call) => !call.url.endsWith("auth.test"));
globalThis.fetch = async (url, init) => {
  outbound.push({ url: String(url), raw: String(init.body), authorization: new Headers(init.headers).get("authorization"), body: Object.fromEntries(new URLSearchParams(String(init.body))) });
  const name = new URL(String(url)).pathname.split("/").at(-1);
  if (new URL(String(url)).hostname === "files.slack.com") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/webm" } });
  if (scenario === "working-reaction-errors" && name === "reactions.add") return Response.json({ ok: false, error: "missing_scope" });
  if (scenario === "working-reaction-errors" && name === "reactions.remove") throw new Error("network down");
  if (name === "auth.test") return Response.json({ ok: true, team_id: tokenTeams[outbound.at(-1).authorization] });
  if (name === "conversations.info") return Response.json({ ok: true, channel: { id: "C-room", is_private: false } });
  if (name === "conversations.replies") return Response.json({ ok: true, messages: [{ ts: "1.5", user: "U-other", text: "Prior topic" }] });
  return Response.json({ ok: true, ts: "posted-message" });
};
const { SessionNotActiveError } = await import("eve/sessions");
let owner = "original-session";
let ends = 0;
const sends = [];
const responds = [];
const cancels = [];
const delivery = (sessionId, outcome = "applied") => ({
  sessionId, deliveryId: "fixture-delivery",
  stream: async function* () {},
  result: async () => ({ deliveryId: "fixture-delivery", sessionId, outcome, sessionEnded: false, reply: undefined, data: undefined, interactions: [], status: "completed" }),
});
const sessionHandle = (id) => ({
  id,
  cancel: async (options) => {
    if (owner !== id) throw new SessionNotActiveError();
    cancels.push({ id, options });
    return delivery(id);
  },
  end: async () => {
    if (owner !== id) throw new SessionNotActiveError();
    ends++;
    owner = undefined;
    return delivery(id);
  },
});
const { default: channel } = await import(${JSON.stringify(channelPath)});
const { notraSlackRenderer } = await import(${JSON.stringify(rendererPath)});
const { handleSlackControl } = await import(${JSON.stringify(controlsPath)});
const { buildSlackBinding } = await import(runtimePath + "/public/channels/slack/api.js");
const binding = buildSlackBinding({ botToken: "fixture-install", channelId: "C-room", threadTs: "1.0", installationTeamId: "T-install", teamId: "T-actor" });
let eventId = 0;
const tasks = [];
const args = {
  from: (address) => ({
    send: async (message, options) => {
      const startedSession = owner === undefined;
      sends.push({ address, message, options, startedSession });
      owner ??= "new-session";
      return delivery(owner);
    },
    respond: async (answers, options) => { responds.push({ address, answers, options }); return delivery(owner); },
  }),
  resolveSession: async () => owner ? sessionHandle(owner) : undefined,
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
// Renderer events, as eve hands them over: the event, its context and next().
const events = notraSlackRenderer.events;
let line = 0;
const fact = (type, data, scope) => ({ type, data, scope, meta: { position: { line: line++, index: 0 }, at: new Date().toISOString(), endOfLine: true } });
let view = emptySessionView();
const requestCall = (turnId, callId, name) => {
  view = foldEvents(view, [fact("call.requested", { callId, owner: { turnId }, capability: { kind: "tool", name } }, { turnId })]);
};
const nextCalls = [];
const next = (type) => async () => { nextCalls.push(type); };
const eventCtx = (eventChannel, sessionId = "session-1") => ({
  session: { id: sessionId, auth: { current: currentAuth, initiator: null } },
  channel: eventChannel, view, position: { line: 0, index: 0 },
});
const emit = (eventChannel, type, data, turnId) =>
  events[type]({ type, data, scope: turnId ? { turnId } : undefined }, eventCtx(eventChannel), next(type));
const toolSettled = (eventChannel, turnId, name, { outcome = "completed", output = {}, callId = "call-" + name } = {}) => {
  requestCall(turnId, callId, name);
  return emit(eventChannel, "call.settled", { callId, outcome, output }, turnId);
};
const reply = (eventChannel, turnId, value, phase = "reply") =>
  emit(eventChannel, "content.completed", { partId: "part-" + (++line), kind: "text", phase, value }, turnId);
const turnStarted = (eventChannel, turnId) => emit(eventChannel, "turn.started", { turnId, cause: {}, follows: null }, turnId);
const turnSettled = (eventChannel, turnId, outcome = "completed", error) =>
  emit(eventChannel, "turn.settled", { turnId, outcome, ...(error ? { error } : {}) }, turnId);
async function until(check) {
  for (let attempt = 0; attempt < 100 && !check(); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert(check());
}
if (scenario === "draft-pr-completion") {
  for (const isError of [false, true]) {
   for (const order of ["draft-first", "pr-first"]) {
    const messages = [];
    const state = { installationTeamId: "T-install" };
    const eventChannel = { state, thread: { post: async (text) => messages.push(text) } };
    const pr = () => toolSettled(eventChannel, "turn-1", "create_content_pull_request", { outcome: isError ? "failed" : "completed" });
    const draft = () => toolSettled(eventChannel, "turn-1", "create_linkedin_post");
    for (const settle of order === "draft-first" ? [draft, pr] : [pr, draft]) {
      await settle();
    }
    await reply(eventChannel, "turn-1", "Let me open the PR.", "narration");
    assert.deepEqual(state.notraContentPullRequestTurnIds, ["turn-1"]);
    assert.deepEqual(messages, []);
    const text = isError ? "The draft was saved, but PR creation failed." : "Draft PR: https://github.com/example/repo/pull/42";
    await reply(eventChannel, "turn-1", text);
    assert.deepEqual(messages, [text]);
    assert.deepEqual(state.notraContentPullRequestTurnIds, []);
    await toolSettled(eventChannel, "turn-2", "create_linkedin_post", { callId: "draft-2" });
    await reply(eventChannel, "turn-2", "Draft text");
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
  const blocks = renderInteractionBlocks({
    interactionId: "int-1", turnId: "turn-1", stepIndex: 0, status: "open",
    request: { kind: "approval", prompt: "Approve publishing?", options: [{ id: "approve", label: "Approve" }, { id: "deny", label: "Deny" }] },
    call: { callId: "call-1", name: "publish_content", input: { markdown: "Draft" } },
  });
  const buttonsOf = (block) => [...(block.actions ?? []), ...(block.type === "actions" ? block.elements ?? [] : []), ...(block.child_blocks ?? []).flatMap(buttonsOf)];
  const buttons = blocks.flatMap(buttonsOf);
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    await request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: scenario === "approval-guest" ? "T-actor" : "T-install" },
      channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0", blocks }, actions: [button] }, true);
  }
  await Promise.all(tasks);
  if (scenario === "approval-guest") {
    assert.equal(responds.length, 0);
    assert.equal(ephemerals().length, 2);
    assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
  } else {
    assert.deepEqual(responds.map((call) => call.answers.map((answer) => [answer.interactionId, answer.optionId])), [[["int-1", "approve"]], [["int-1", "deny"]]]);
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
  assert.equal(sends.length, 0);
} else if (scenario === "initial-status") {
  owner = undefined;
  await message("<@U-notra> chart our GEO performance", true);
  await mirrorEntered;
  const statuses = () => outbound.filter((call) => call.url.endsWith("assistant.threads.setStatus"));
  await until(() => statuses().length > 0);
  assert.equal(statuses().length, 1);
  const [status] = statuses();
  assert.equal(status.authorization, "Bearer fixture-install");
  assert.equal(status.body.channel_id, "C-room");
  assert.equal(status.body.thread_ts, "2.1");
  assert.equal(status.body.status, "On it…");
  assert(status.raw.includes("Doing+overtime"));
  assert.equal(sends.length, 0);
  releaseMirror();
  await Promise.all(tasks);
  assert.equal(sends.length, 1);
  assert(sends[0].startedSession);
} else if (scenario === "chart-failure-with-draft") {
  const messages = [];
  const state = { teamId: "T-install", notraChartFailureTurnId: "turn-1", notraDraftCompletion: { turnId: "turn-1", count: 1 } };
  await reply({ state, thread: { post: async (text) => messages.push(text) } }, "turn-1", "Done");
  assert.equal(messages.length, 2);
  assert(messages[0].includes("couldn't render or upload"));
  assert(messages[1].includes("Saved as a draft."));
  assert.equal(state.notraChartFailureTurnId, undefined);
  assert.equal(state.notraDraftCompletion, undefined);
  assert.deepEqual(nextCalls, []);
} else if (scenario === "owner-policy" || scenario === "external-actor" || scenario === "member-actor") {
  const actorTeamId = { "owner-policy": "T-actor", "external-actor": "T-unknown", "member-actor": "T-install" }[scenario];
  for (const actionId of ["notra_stop_turn", "notra_leave_thread"]) {
    await request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: actorTeamId },
      channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [{ action_id: actionId, value: JSON.stringify({ sessionId: "original-session", turnId: "turn-0" }) }] }, true);
  }
  await Promise.all(tasks);
  assert.equal(ends, scenario === "member-actor" ? 1 : 0);
  assert.equal(cancels.length, scenario === "member-actor" ? 1 : 0);
  assert(outbound.every((call) => call.authorization === "Bearer fixture-install"));
  if (scenario === "external-actor") {
    assert.equal(slackCalls().length, 2);
    assert.equal(ephemerals().length, 2);
    assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
  } else {
    assert.equal(ephemerals().length, 0);
  }
} else if (scenario === "post-x-guest") {
  redisStore.set("slack:post-x:call-install", JSON.stringify({ organizationId: "org-install", accountId: "acct-org-install", username: "org-install-x", text: "Hello" }));
  const click = (action) => request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-guest", team_id: "T-actor" },
    channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [action] }, true);
  await click({ action_id: "notra_post_x_confirm:call-install", value: JSON.stringify({ callId: "call-install", username: "x" }) });
  await click({ action_id: "notra_post_x_account:call-install", selected_option: { value: JSON.stringify({ callId: "call-install", accountId: "alt-org-install", username: "org-install-alt" }) } });
  await click({ action_id: "notra_post_x_publish:call-install", value: "call-install" });
  await click({ action_id: "notra_post_x_cancel:call-install", value: "call-install" });
  await Promise.all(tasks);
  assert.deepEqual(linkedLookups, []);
  assert.equal(published.length, 0);
  assert.equal(JSON.parse(redisStore.get("slack:post-x:call-install")).accountId, "acct-org-install");
  assert.equal(slackCalls().filter((call) => !call.url.endsWith("chat.postEphemeral")).length, 0);
  assert.equal(ephemerals().length, 4);
  assert(ephemerals().every((text) => text.includes("Only members of this workspace")));
} else if (scenario === "post-x-slack-connect") {
  const pending = (organizationId) => JSON.stringify({ organizationId, accountId: "acct-" + organizationId, username: organizationId + "-x", text: "Hello" });
  redisStore.set("slack:post-x:call-install", pending("org-install"));
  redisStore.set("slack:post-x:call-actor", pending("org-actor"));
  const click = (action) => request({ type: "block_actions", app_installed_team_id: "T-install", team: { id: "T-install" }, user: { id: "U-human", team_id: "T-install" },
    channel: { id: "C-room" }, message: { ts: "card-1", thread_ts: "1.0" }, actions: [action] }, true);
  for (const callId of ["call-install", "call-actor"]) {
    await click({ action_id: "notra_post_x_confirm:" + callId, value: JSON.stringify({ callId, username: "x" }) });
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
  await handleSlackControl("leave", { thread: binding.thread, resolveSession: async () => owner ? sessionHandle(owner) : undefined });
  releaseMirror();
  await Promise.all(tasks);
  assert.equal(ends, 1);
  assert.equal(owner, undefined);
  assert.equal(sends.length, 0);
  // The reply's 👀 comes off since it won't get a turn.
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.1")]);
  assert.deepEqual(await redisMembers(), []);
} else if (scenario === "reply") {
  await message("follow-up");
  await Promise.all(tasks);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].address, "C-room:1.0");
  assert(!sends[0].startedSession);
  const content = JSON.stringify(sends[0].message);
  assert(content.includes("follow-up"));
  assert(content.includes("Prior topic"));
  assert(content.includes("U-human"));
  assert.equal(sends[0].options.auth.attributes.organizationId, "org-install");
} else if (scenario === "addressing") {
  await message("cool");
  await message("<@U0COLLEAGUE> see, we're growing");
  await message("and the week before?");
  await Promise.all(tasks);
  assert.equal(sends.length, 1);
  assert(JSON.stringify(sends[0].message).includes("and the week before?"));
  // Skipped replies get no 👀 and are not counted as requests.
  assert.deepEqual(reactionCalls("reactions.add"), [eyes("2.3")]);
  assert.equal(metricInserts.length, 1);
  assert.equal(evaluations.length, 3);
  assert.equal(evaluations[0].organizationId, "org-install");
  assert.equal(evaluations[0].state.recentThread, "Person 1: Prior topic");
  assert.equal(evaluations[0].state.latestMessage, "Person 2: cool");
  assert.equal(evaluations[1].state.latestMessage, "Person 2: @Person 3 see, we're growing");
  // Without the classifier only replies naming someone else are skipped,
  // and the thread history is not fetched.
  evaluationAvailable = false;
  const repliesBefore = outbound.filter((call) => call.url.endsWith("conversations.replies")).length;
  await message("<@U0COLLEAGUE> look at this");
  await message("thanks");
  await Promise.all(tasks);
  assert.equal(sends.length, 2);
  assert(JSON.stringify(sends[1].message).includes("thanks"));
  // Only the delivered reply loads thread context.
  assert.equal(outbound.filter((call) => call.url.endsWith("conversations.replies")).length, repliesBefore + 1);
  // Controls still work without a mention.
  await message("stop");
  await Promise.all(tasks);
  assert.equal(sends.length, 2);
  assert.deepEqual(cancels, [{ id: "original-session", options: undefined }]);
  assert.equal(evaluations.length, 3);
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
  assert.equal(sends.length, 1);
  assert(sends[0].startedSession);
  assert.equal(sends[0].options.auth.attributes.slackWorkingReactionsKey, "slack:working-reactions:T-install:C-room:1.0");
  currentAuth = sends[0].options.auth;
  await turnStarted(eventChannel, "turn-1");
  assert.deepEqual(reactionCalls("reactions.remove"), []);
  // Narration keeps the reaction; posting the answer clears it.
  await reply(eventChannel, "turn-1", "Looking that up", "narration");
  assert.deepEqual(reactionCalls("reactions.remove"), []);
  await reply(eventChannel, "turn-1", "Here's the draft.");
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.3")]);
  await turnSettled(eventChannel, "turn-1");
  assert.deepEqual(reactionCalls("reactions.remove"), [eyes("2.3")]);
  await emit(eventChannel, "delivery.settled", { deliveryId: "delivery-1", outcome: "handled" });
  assert.equal(reactionCalls("reactions.remove").length, 1);
  // Two replies delivered together expose only the last one's auth; both
  // reactions still clear when that turn fails.
  await message("follow-up");
  await message("one more thing");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").slice(1), [eyes("2.4"), eyes("2.5")]);
  currentAuth = sends[2].options.auth;
  await turnStarted(eventChannel, "turn-2");
  await turnSettled(eventChannel, "turn-2", "failed", { code: "error", message: "boom" });
  assert.deepEqual(reactionCalls("reactions.remove").slice(1).map((call) => call.timestamp).sort(), ["2.4", "2.5"]);
  // Stopping a turn clears its reaction; the stop message itself gets none.
  await message("next request");
  await message("stop");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").slice(3), [eyes("2.6")]);
  currentAuth = sends[3].options.auth;
  await turnStarted(eventChannel, "turn-3");
  await turnSettled(eventChannel, "turn-3", "cancelled");
  assert.deepEqual(reactionCalls("reactions.remove").slice(3), [eyes("2.6")]);
  // A reply the session refuses loses its 👀 once the session is idle again.
  await message("too late");
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add").at(-1), eyes("2.8"));
  await emit(eventChannel, "delivery.settled", { deliveryId: "delivery-2", outcome: "refused" });
  assert.deepEqual(reactionCalls("reactions.remove").at(-1), eyes("2.8"));
  assert.deepEqual(await redisMembers(), []);
} else if (scenario === "working-reaction-blocked") {
  owner = undefined;
  await message("<@U-notra> draft a post", true);
  await Promise.all(tasks);
  assert.equal(sends.length, 0);
  assert.deepEqual(reactionCalls("reactions.add"), []);
} else if (scenario === "working-reaction-errors") {
  const eventChannel = { ...binding, state: { installationTeamId: "T-install", channelId: "C-room" } };
  owner = undefined;
  await message("<@U-notra> draft a post", true);
  await Promise.all(tasks);
  assert.deepEqual(reactionCalls("reactions.add"), [eyes("2.1")]);
  assert.equal(sends.length, 1);
  currentAuth = sends[0].options.auth;
  await turnStarted(eventChannel, "turn-1");
  await reply(eventChannel, "turn-1", "Done");
  await turnSettled(eventChannel, "turn-1");
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
  assert.equal(sends.length, 1);
  const content = JSON.stringify(sends[0].options);
  assert(content.includes("Transcript:\\\\n\\\\nDraft a LinkedIn post about the launch"));
  assert.deepEqual(charged.map((call) => [call.customerId, call.featureId, call.value, call.properties.audio_seconds]), [["org-install", "ai_credits", 1, 30]]);
  // When one of two clips fails the agent is told part of the message is missing.
  failTranscription = (call) => call === 3;
  const second = { ...clip.files[0], id: "F-clip-2" };
  await message("", false, { ...clip, files: [clip.files[0], second] });
  await Promise.all(tasks);
  assert.equal(sends.length, 2);
  assert(JSON.stringify(sends[1].options).includes("1 more voice clip in that message could not be transcribed"));
  assert.equal(charged.length, 2);
  // A voice-only message nobody could transcribe never starts a turn or a charge.
  failTranscription = () => true;
  await message("", false, clip);
  await Promise.all(tasks);
  assert.equal(sends.length, 2);
  assert.equal(charged.length, 2);
  assert(outbound.some((call) => call.url.endsWith("chat.postMessage") && decodeURIComponent(call.raw.replaceAll("+", " ")).includes("transcribe that voice message")));
} else if (scenario === "metrics-triggers") {
  await message("<@U-notra> how did the launch go?", true);
  await message("and last week?");
  await message("<@U-notra> stop", true);
  await request({ type: "event_callback", team_id: "T-install", api_app_id: "A-notra", event_id: "event-dm", authorizations: [{ is_bot: true, team_id: "T-install", user_id: "U-notra" }],
    event: { type: "message", channel: "D-dm", channel_type: "im", ts: "3.1", user: "U-human", text: "draft a tweet" } });
  await request({ type: "event_callback", team_id: "T-install", api_app_id: "A-notra", event_id: "event-bot", authorizations: [{ is_bot: true, team_id: "T-install", user_id: "U-notra" }],
    event: { type: "message", channel: "C-room", thread_ts: "1.0", ts: "2.9", user: "U-notra", bot_id: "B-notra", app_id: "A-notra", text: "my own reply" } });
  await Promise.all(tasks);
  assert.deepEqual(metricInserts.map((row) => [row.trigger, row.status, row.channelId, row.messageTs, row.threadTs]), [
    ["mention", "pending", "C-room", "2.1", "1.0"],
    ["thread_reply", "pending", "C-room", "2.2", "1.0"],
    ["direct_message", "pending", "D-dm", "3.1", "3.1"],
  ]);
  for (const row of metricInserts) {
    assert.equal(row.organizationId, "org-install");
    assert.equal(row.slackTeamId, "T-install");
    assert.equal(row.slackUserId, "U-human");
    assert.equal(row.sentAt.getTime(), Number(row.messageTs) * 1000);
    assert.equal(typeof row.id, "string");
  }
  assert.equal(metricUpdates.length, 0);
  // Uninstalling keeps the counts but drops who asked.
  await request({ type: "event_callback", team_id: "T-install", api_app_id: "A-notra", event_id: "event-uninstall", event: { type: "app_uninstalled" } });
  await Promise.all(tasks);
  assert.deepEqual(metricUpdates, [{ values: { slackUserId: null }, params: ["T-install"] }]);
} else if (scenario === "metrics-blocked") {
  await message("<@U-notra> are you here?", true);
  await message("not for the bot");
  await Promise.all(tasks);
  assert.equal(metricInserts.length, 1);
  assert.equal(metricInserts[0].status, "blocked");
  assert.equal(metricInserts[0].trigger, "mention");
  assert.equal(metricInserts[0].organizationId, "org-install");
  assert.equal(outbound.filter((call) => call.url.endsWith("chat.postEphemeral")).length, 1);
  assert.equal(sends.length, 0);
} else if (scenario === "metrics-turns") {
  const posts = [];
  const state = { installationTeamId: "T-install", teamId: "T-install", channelId: "C-room", threadTs: "1.0" };
  const slackCtx = { state, thread: { post: async (text) => posts.push(text), startTyping: async () => {} }, slack: { threadTs: "1.0" } };
  const finishes = () => metricUpdates.filter((update) => "toolNames" in update.values);
  const threadCloses = () => metricUpdates.filter((update) => "status" in update.values && !("toolNames" in update.values));
  const firstReplies = () => metricUpdates.filter((update) => !("status" in update.values));
  const lastUpdate = () => finishes().at(-1);

  // Answered turn with tools; the pre-tool narration is not a reply.
  state.triggeringMessageTs = "2.5";
  await turnStarted(slackCtx, "turn-1");
  await toolSettled(slackCtx, "turn-1", "search_web");
  await toolSettled(slackCtx, "turn-1", "get_web_analytics", { outcome: "failed" });
  await reply(slackCtx, "turn-1", "Let me check.", "narration");
  assert.equal(state.notraTurnMetrics.firstResponseAt, undefined);
  assert.equal(firstReplies().length, 0);
  await reply(slackCtx, "turn-1", "Here you go.");
  // The reply time is saved as soon as the answer is posted, once per turn.
  assert.equal(firstReplies().length, 1);
  assert.deepEqual(firstReplies()[0].params, ["T-install", "C-room", "2.5"]);
  assert(firstReplies()[0].values.firstResponseAt instanceof Date);
  await turnSettled(slackCtx, "turn-1");
  let update = lastUpdate();
  assert.deepEqual(update.params, ["T-install", "C-room", "2.5"]);
  assert.equal(update.values.status, "completed");
  assert.equal(update.values.sessionId, "session-1");
  assert.equal(update.values.turnId, "turn-1");
  assert.deepEqual(update.values.toolNames, ["search_web", "get_web_analytics"]);
  assert.equal(update.values.errorCode, null);
  assert(update.values.startedAt <= update.values.firstResponseAt);
  assert(update.values.firstResponseAt <= update.values.finishedAt);
  assert.equal(update.values.firstResponseAt.getTime(), firstReplies()[0].values.firstResponseAt.getTime());
  assert.equal(state.notraTurnMetrics, undefined);
  assert.deepEqual(posts, ["Here you go."]);

  // Failed turn: recorded with its code, no reply time.
  state.triggeringMessageTs = "2.6";
  await turnStarted(slackCtx, "turn-2");
  const nextCallsBeforeFailure = nextCalls.length;
  await turnSettled(slackCtx, "turn-2", "failed", { code: "model_error", message: "boom", id: "err-1" });
  // Notra posts its own failure notice instead of eve's.
  assert.equal(nextCalls.length, nextCallsBeforeFailure);
  update = lastUpdate();
  assert.deepEqual(update.params, ["T-install", "C-room", "2.6"]);
  assert.equal(update.values.status, "failed");
  assert.equal(update.values.errorCode, "model_error");
  assert.equal(update.values.firstResponseAt, undefined);
  assert(posts.at(-1).includes("err-1"));

  // Stopped turn.
  state.triggeringMessageTs = "2.7";
  await turnStarted(slackCtx, "turn-3");
  await turnSettled(slackCtx, "turn-3", "cancelled");
  assert.equal(lastUpdate().values.status, "cancelled");

  // A turn parked on an approval card already answered the person, before the turn ends.
  state.triggeringMessageTs = "2.8";
  await turnStarted(slackCtx, "turn-4");
  await emit(slackCtx, "interaction.opened", { interactionId: "int-4", subject: { turnId: "turn-4" }, request: { kind: "question", prompt: "Which one?" } }, "turn-4");
  assert.deepEqual(firstReplies().at(-1).params, ["T-install", "C-room", "2.8"]);
  assert.equal(lastUpdate().params[2], "2.7");
  await turnSettled(slackCtx, "turn-4");
  assert(lastUpdate().values.firstResponseAt instanceof Date);

  // A saved tweet card posted mid-turn is the first reply, not the later summary.
  currentAuth = { attributes: { organizationId: "org-install" } };
  state.triggeringMessageTs = "2.10";
  await turnStarted(slackCtx, "turn-6");
  await toolSettled(slackCtx, "turn-6", "create_twitter_post", { output: { postId: "post-1" } });
  assert(posts.includes("Saved tweet"));
  assert.deepEqual(firstReplies().at(-1).params, ["T-install", "C-room", "2.10"]);
  const tweetReplyAt = state.notraTurnMetrics.firstResponseAt;
  await reply(slackCtx, "turn-6", "Done.");
  assert.equal(posts.at(-1), "Saved as a draft.");
  assert.equal(state.notraTurnMetrics.firstResponseAt, tweetReplyAt);
  assert.equal(firstReplies().filter((update) => update.params[2] === "2.10").length, 1);
  await turnSettled(slackCtx, "turn-6");
  assert.equal(lastUpdate().values.firstResponseAt.getTime(), tweetReplyAt);
  currentAuth = null;

  // A message arriving mid-turn does not take the running turn's result.
  state.triggeringMessageTs = "3.1";
  await turnStarted(slackCtx, "turn-7");
  state.triggeringMessageTs = "3.9";
  await reply(slackCtx, "turn-7", "First.");
  assert.deepEqual(firstReplies().at(-1).params, ["T-install", "C-room", "3.1"]);
  await turnSettled(slackCtx, "turn-7");
  assert.deepEqual(lastUpdate().params, ["T-install", "C-room", "3.1"]);

  // Earlier messages in the thread that never got their own turn are answered by this one.
  const close = threadCloses().at(-1);
  assert.deepEqual(close.params.slice(0, 4), ["T-install", "C-room", "1.0", "pending"]);
  assert.equal(new Date(close.params[4]).getTime(), 3100);
  assert.equal(close.values.status, "completed");
  assert.equal(close.values.turnId, "turn-7");
  assert(close.values.firstResponseAt instanceof Date);
  assert.equal(threadCloses().length, finishes().length);

  // A turn whose start was not seen still records its outcome.
  state.triggeringMessageTs = "2.9";
  await turnSettled(slackCtx, "turn-5");
  assert.equal(lastUpdate().values.status, "completed");
  assert.deepEqual(lastUpdate().values.toolNames, []);
  assert.deepEqual(lastUpdate().params, ["T-install", "C-room", "2.9"]);
  assert.equal(finishes().length, 7);
} else if (scenario === "metrics-db-down") {
  failMetricWrites = true;
  await message("<@U-notra> still answer me", true);
  await Promise.all(tasks);
  assert.equal(sends.length, 1);
  const posts = [];
  const state = { installationTeamId: "T-install", teamId: "T-install", channelId: "C-room", threadTs: "1.0", triggeringMessageTs: "2.1" };
  const slackCtx = { state, thread: { post: async (text) => posts.push(text), startTyping: async () => {} }, slack: { threadTs: "1.0" } };
  await turnStarted(slackCtx, "turn-1");
  await reply(slackCtx, "turn-1", "Answered anyway.");
  await turnSettled(slackCtx, "turn-1");
  await turnSettled(slackCtx, "turn-1", "failed", { code: "x", message: "boom" });
  assert.equal(posts[0], "Answered anyway.");
  assert.equal(posts.length, 2);
  assert.equal(metricInserts.length + metricUpdates.length, 0);
} else if (scenario === "mention-after-leave") {
  await handleSlackControl("leave", { thread: binding.thread, resolveSession: async () => owner ? sessionHandle(owner) : undefined });
  await message("unmentioned follow-up");
  await Promise.all(tasks);
  assert.equal(sends.length, 0);
  await message("<@U-notra> start again", true);
  await Promise.all(tasks);
  assert.equal(sends.length, 1);
  assert(sends[0].startedSession);
  assert.equal(owner, "new-session");
} else {
  throw new Error("unknown scenario " + scenario);
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
  test("both decisions on eve's approval card reach the session", () =>
    runSlackChannel("approval-payload"));
  test("Slack Connect guests cannot answer approvals", () =>
    runSlackChannel("approval-guest"));
  test("saved tweets only publish after the requester confirms, at most once", () =>
    runSlackChannel("saved-tweet-publish"));
  test("the first top-level mention shows Notra's status before preparing the session", () =>
    runSlackChannel("initial-status"));
  test("a chart failure does not hide draft creation", () =>
    runSlackChannel("chart-failure-with-draft"));
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
  test("thread replies keep speaker attribution and thread context", () =>
    runSlackChannel("reply"));
  test("unmentioned thread replies only start a turn when they are meant for Notra", () =>
    runSlackChannel("addressing"));
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

describe("Slack bot metrics", () => {
  test("records mentions, thread replies and DMs, but not controls or bot messages", () =>
    runSlackChannel("metrics-triggers"));
  test("records mentions in channels the workspace has not enabled as blocked", () =>
    runSlackChannel("metrics-blocked"));
  test("records each turn's outcome, tools and first reply time", () =>
    runSlackChannel("metrics-turns"));
  test("keeps answering when the metrics database is down", () =>
    runSlackChannel("metrics-db-down"));
});
