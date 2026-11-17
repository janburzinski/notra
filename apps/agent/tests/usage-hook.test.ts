import { expect, test } from "bun:test";
import { resolve } from "node:path";

const hookPath = resolve(import.meta.dir, "../agent/lib/hooks/usage.ts");

// A Redis with the commands the usage hook calls. `eval` follows
// ACCUMULATE_USAGE_SCRIPT: a run's usage is added once, into the turn's hash.
const FAKE_REDIS = `
const store = new Map();
const fakeRedis = {
  async set(key, value, options = {}) {
    if (options.nx && store.has(key)) return null;
    store.set(key, value);
    return "OK";
  },
  async exists(...keys) { return keys.filter((key) => store.has(key)).length; },
  async persist() { return 1; },
  async del(...keys) { for (const key of keys) store.delete(key); return keys.length; },
  async rename(from, to) { store.set(to, store.get(from)); store.delete(from); return "OK"; },
  async hgetall(key) { return store.get(key) ?? null; },
  async eval(_script, [runKey, accKey, billingKey, billedKey], args) {
    if (store.has(runKey)) return 0;
    const fields = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "costMicroUsd"];
    const hash = store.get(accKey) ?? {};
    fields.forEach((field, i) => { hash[field] = String(Number(hash[field] ?? 0) + Number(args[i])); });
    store.set(accKey, hash);
    store.set(runKey, "1");
    return store.has(billingKey) || store.has(billedKey) ? 2 : 1;
  },
};
`;

// Runs the real usage hook in its own process so module mocks stay isolated.
function runUsageScenario(withRedis: boolean, body: string) {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { emptySessionView, foldEvents } from "eve/events";
${FAKE_REDIS}
const charges = [];
mock.module("@notra/ai/utils/redis", () => ({ redis: ${withRedis ? "fakeRedis" : "null"} }));
mock.module("@notra/ai/billing/autumn", () => ({
  allowUnmeteredAiInDevelopment: false,
  autumn: { track: async (input) => { charges.push(input); } },
}));
mock.module("@notra/ai/utils/server-log", () => ({
  logError: (message, error) => console.error(message, error),
  logWarn: () => {},
}));
mock.module("@notra/posthog/server", () => ({
  captureServerEvent: () => {},
  flushPostHogServer: async () => {},
}));
const { createUsageHook } = await import(${JSON.stringify(hookPath)});
const hook = createUsageHook("zai/glm-5.3-flash");

let line = 0;
const fact = (type, data, scope) => ({ type, data, scope, meta: { position: { line: line++, index: 0 }, at: new Date().toISOString(), endOfLine: true } });
let view = emptySessionView();
const fold = (...facts) => { view = foldEvents(view, facts); };
const run = (turnId, runId, outcome) => fold(
  fact("model.requested", { runId, owner: { turnId } }, { turnId, runId }),
  fact("model.started", { runId, modelId: "zai/glm-5.3-flash", attempt: 0 }, { turnId, runId }),
  fact("model.settled", { runId, outcome }, { turnId, runId }),
);
const usage = { inputTokens: 1200, outputTokens: 80, cacheReadTokens: 1000, cacheWriteTokens: 0 };
const ctx = () => ({
  session: { id: "session-1", auth: { current: { attributes: { organizationId: "org-1" } }, initiator: null } },
  agent: { name: "agent" }, channel: { kind: "channel:eve" }, view, turn: { id: "turn_0" }, position: { line, index: 0 },
});
const record = (data, scope) => hook.events["usage.recorded"]({ type: "usage.recorded", data: { kind: "model", usage, ...data }, scope }, ctx());
const settle = (turnId) => hook.events["turn.settled"]({ type: "turn.settled", data: { turnId, outcome: "completed" }, scope: { turnId } }, ctx());
fold(fact("turn.started", { turnId: "turn_0" }, { turnId: "turn_0" }));
${body}
`,
    ],
    { cwd: resolve(import.meta.dir, ".."), timeout: 30_000 }
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.exitCode;
}

test("bills a turn's completed model runs only, never failed runs, compaction, delegated spend or side calls", () => {
  expect(
    runUsageScenario(
      false,
      `
run("turn_0", "run_0", "completed");
await record({ owner: { runId: "run_0" } }, { turnId: "turn_0", runId: "run_0" });
run("turn_0", "run_1", "failed");
await record({ owner: { runId: "run_1" } }, { turnId: "turn_0", runId: "run_1" });
await record({ owner: { runId: "run_2" } }, { changeId: "change_0", runId: "run_2" });
await record({ owner: { callId: "call_0" } }, { turnId: "turn_0" });
await record({ kind: "decision", owner: { runId: "run_0" } }, { turnId: "turn_0", runId: "run_0" });

assert.equal(charges.length, 1);
const [charge] = charges;
assert.equal(charge.customerId, "org-1");
assert.equal(charge.properties.turn_id, "turn_0");
assert.equal(charge.properties.run_id, "run_0");
assert.equal(charge.properties.input_tokens, 200);
assert.equal(charge.properties.cache_read_tokens, 1000);
assert.equal(charge.properties.output_tokens, 80);
`
    )
  ).toBe(0);
});

test("counts a repeated usage event once and charges the turn once when it settles", () => {
  expect(
    runUsageScenario(
      true,
      `
run("turn_0", "run_0", "completed");
await record({ owner: { runId: "run_0" } }, { turnId: "turn_0", runId: "run_0" });
await record({ owner: { runId: "run_0" } }, { turnId: "turn_0", runId: "run_0" });
run("turn_0", "run_1", "completed");
await record({ owner: { runId: "run_1" } }, { turnId: "turn_0", runId: "run_1" });
assert.equal(charges.length, 0);

await settle("turn_0");
await settle("turn_0");

assert.equal(charges.length, 1);
const [charge] = charges;
assert.equal(charge.properties.turn_id, "turn_0");
assert.equal(charge.properties.input_tokens, 400);
assert.equal(charge.properties.cache_read_tokens, 2000);
assert.equal(charge.properties.output_tokens, 160);
`
    )
  ).toBe(0);
});
