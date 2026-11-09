import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  releaseHours,
  releaseStarted,
  releaseTimeZone,
  releaseWindowStart,
  watchProductionDeploy,
} from "./production-deploy-watchdog.mjs";

const env = {
  GH_TOKEN: "test",
  GITHUB_REPOSITORY: "usenotra/notra",
  SLACK_WEBHOOK_URL: "https://hooks.slack.test/deploy",
};
const now = Date.parse("2026-11-09T18:40:00Z");
const run = (id, status, conclusion = null) => ({
  id,
  event: "schedule",
  status,
  conclusion,
});

function github(runs, jobCounts = {}, at = now) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      body: init.body,
    });
    const path = String(url);
    if (path.includes("/runs?event=schedule&created=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ workflow_runs: runs }),
      };
    }
    const jobs = /\/runs\/(\d+)\/jobs/.exec(path);
    if (jobs) {
      const total_count = jobCounts[jobs[1]] ?? 0;
      return { ok: true, status: 200, json: async () => ({ total_count }) };
    }
    if (path.endsWith("/dispatches") || path.startsWith("https://hooks.")) {
      return { ok: true, status: 204, json: async () => null };
    }
    throw new Error(`unexpected request ${path}`);
  };
  const watch = () =>
    watchProductionDeploy({ env, fetchImpl, now: at, report: () => {} });
  return { watch, calls };
}

test("release windows match the production deploy schedule", () => {
  const schedule = readFileSync(
    ".github/workflows/production-deploy.yml",
    "utf8"
  );
  assert.match(
    schedule,
    new RegExp(`cron: "0 ${releaseHours.join(",")} \\* \\* \\*"`)
  );
  assert.match(schedule, new RegExp(`timezone: ${releaseTimeZone}`));
});

test("finds the latest Berlin release window, across DST and midnight", () => {
  const start = (at) =>
    new Date(releaseWindowStart(Date.parse(at))).toISOString();
  // Winter (UTC+1)
  assert.equal(start("2026-11-09T18:40:00Z"), "2026-11-09T18:00:00.000Z");
  assert.equal(start("2026-11-09T12:35:00Z"), "2026-11-09T11:00:00.000Z");
  assert.equal(start("2026-11-09T10:59:59Z"), "2026-11-08T18:00:00.000Z");
  assert.equal(start("2026-11-09T11:00:00Z"), "2026-11-09T11:00:00.000Z");
  // Summer (UTC+2)
  assert.equal(start("2026-07-01T17:40:00Z"), "2026-07-01T17:00:00.000Z");
  assert.equal(start("2026-07-01T10:40:00Z"), "2026-07-01T10:00:00.000Z");
});

test("a late watchdog still finds the window's own release", async () => {
  // 13:35 Berlin: the 12:00 release started at 11:10 UTC.
  const late = Date.parse("2026-11-09T12:35:00Z");
  const { watch, calls } = github(
    [run(7, "completed", "success")],
    { 7: 7 },
    late
  );
  assert.deepEqual(await watch(), { restarted: false });
  assert.match(calls[0].url, /created=2026-11-09T11:00:00\.000Z\.\./);
});

test("waits while the scheduled run may still be queued", async () => {
  const early = Date.parse("2026-11-09T18:20:00Z");
  const { watch, calls } = github([], {}, early);
  assert.deepEqual(await watch(), { restarted: false });
  assert.equal(calls.length, 0);
});

test("a release counts as started once a job exists or it is still running", () => {
  assert.equal(releaseStarted([]), false);
  assert.equal(
    releaseStarted([{ ...run(1, "completed", "failure"), jobCount: 0 }]),
    false
  );
  assert.equal(
    releaseStarted([{ ...run(1, "completed", "failure"), jobCount: 7 }]),
    true
  );
  assert.equal(
    releaseStarted([{ ...run(1, "in_progress"), jobCount: 0 }]),
    true
  );
  assert.equal(releaseStarted([{ ...run(1, "queued"), jobCount: 0 }]), true);
});

test("restarts the release and alerts Slack when the run failed before any job", async () => {
  const { watch, calls } = github([run(42672259531, "completed", "failure")]);
  assert.deepEqual(await watch(), {
    restarted: true,
    reason: "the scheduled run failed before any job started",
  });
  assert.match(
    calls[0].url,
    /production-deploy\.yml\/runs\?event=schedule&created=2026-11-09T18:00:00\.000Z\.\.2026-11-09T18:40:00\.000Z/
  );
  const dispatch = calls.find((call) => call.url.endsWith("/dispatches"));
  assert.equal(dispatch.method, "POST");
  assert.deepEqual(JSON.parse(dispatch.body), { ref: "main" });
  const slack = calls.find((call) => call.url === env.SLACK_WEBHOOK_URL);
  assert.match(JSON.parse(slack.body).text, /Production deploy restarted/);
});

test("restarts the release when the scheduled run never started", async () => {
  const { watch, calls } = github([]);
  assert.equal((await watch()).reason, "the scheduled run never started");
  assert.ok(calls.some((call) => call.url.endsWith("/dispatches")));
});

test("leaves a release alone once it started, even if it failed", async () => {
  for (const runs of [
    [run(1, "in_progress")],
    [run(2, "completed", "success")],
    [run(3, "completed", "failure")],
  ]) {
    const { watch, calls } = github(runs, { 2: 7, 3: 5 });
    assert.deepEqual(await watch(), { restarted: false });
    assert.ok(!calls.some((call) => call.method === "POST"));
  }
});

test("a failed restart fails the watchdog run", async () => {
  const fetchImpl = async (url) =>
    String(url).endsWith("/dispatches")
      ? { ok: false, status: 403 }
      : { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
  await assert.rejects(
    watchProductionDeploy({ env, fetchImpl, now, report: () => {} }),
    /dispatches: HTTP 403/
  );
});
