import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

import type { LifecycleJournalReport } from "../../../apps/sites-e2e/tests/types/lifecycle-journal";
import {
  DATABASE_REGRESSION_FILES,
  DATABASE_REGRESSION_PORT,
} from "./constants/database-regressions";
import {
  REDIS_TEST_LABEL,
  REDIS_TEST_LABEL_VALUE,
} from "./constants/redis-rest";
import type { DatabaseRegressionResult } from "./types/database-regressions";
import {
  createTestSnapshot,
  deleteTestSnapshot,
  sweepStaleTestSnapshots,
} from "./utils/box-snapshot";

const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({
  options: {
    report: { type: "string" },
    "database-regressions": { type: "boolean", default: false },
    // Build the connected lifecycle in real Upstash Boxes from a snapshot of
    // this checkout's toolchain. Needs UPSTASH_BOX_API_KEY in the environment.
    box: { type: "boolean", default: false },
  },
});
const boxApiKey = values.box ? process.env.UPSTASH_BOX_API_KEY?.trim() : "";
if (values.box && (!values["database-regressions"] || !boxApiKey)) {
  throw new Error(
    "--box needs --database-regressions and UPSTASH_BOX_API_KEY in the environment."
  );
}
const BOX_LIFECYCLE_FILE =
  "apps/sites-e2e/tests/connected-lifecycle-postgres.test.ts";
const LIFECYCLE_REPORT = "lifecycle.json";
const reportPath = values.report ? resolve(values.report) : undefined;
const directory = mkdtempSync(join(tmpdir(), "notra-dashboard-e2e-"));
// Redacted logs go next to the report so CI keeps them as an artifact; without
// a report they stay in the run's temporary directory.
const logDirectory = reportPath ? join(dirname(reportPath), "logs") : directory;
mkdirSync(logDirectory, { recursive: true });
const children: ChildProcess[] = [];
const redisContainer = `notra-dashboard-redis-e2e-${randomUUID()}`;
const redisToken = randomBytes(32).toString("hex");
const environment: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "development",
  SITES_TEST_ENABLED: "true",
  SITES_TEST_FIXTURE_FLAGS_ENABLED: "true",
  DEV_AUTH_ENABLED: "true",
  DEV_AUTH_EMAIL: "sites-e2e-owner@example.test",
  WORKOS_API_KEY: "placeholder",
  WORKOS_CLIENT_ID: "placeholder",
  WORKOS_COOKIE_PASSWORD: randomBytes(32).toString("hex"),
  WORKFLOW_TARGET_WORLD: "local",
  WORKFLOW_LOCAL_DATA_DIR: join(directory, "workflow-data"),
  WORKFLOW_LOCAL_QUEUE_CONCURRENCY: "2",
  NODE_OPTIONS: "--max-old-space-size=6144",
  SITES_TEST_REDIS_CONTAINER: redisContainer,
  SITES_TEST_REDIS_REST_TOKEN: redisToken,
};
const started = performance.now();
const report = {
  scope: values["database-regressions"]
    ? "isolated-dashboard-http-and-postgres-regressions"
    : "isolated-dashboard-http-smoke",
  passed: false,
  cleanupPassed: false,
  auth: "local-dev-fixture",
  flags: "simulated-fixture",
  redis: "real-local-redis-with-emulated-upstash-rest",
  cloudPublishTested: false,
  boxBuildsTested: values.box,
  staleBoxSnapshotsRemoved: 0,
  boxSnapshot: null as null | {
    version: string;
    snapshotId: string;
    deleted: boolean;
  },
  githubOAuthTested: false,
  workosLoginTested: false,
  temporaryDirectory: directory,
  durationMs: 0,
  checks: null as unknown,
  databaseRegressions: [] as DatabaseRegressionResult[],
  lifecycle: null as LifecycleJournalReport | null,
  errors: [] as string[],
};
let postgresContainer: string | undefined;
let stopped = false;
let childFailed = false;
let redisAllocated = false;
// Set while a regression suite runs, so cancellation can stop its group.
let cancelActive: (() => void) | undefined;
const stop = () => {
  stopped = true;
  cancelActive?.();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function execute(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = (result.stdout + result.stderr)
      .replaceAll(redisToken, "[redacted]")
      .replaceAll(environment.WORKOS_COOKIE_PASSWORD ?? "", "[redacted]");
    writeFileSync(join(logDirectory, "command-failure.log"), output, {
      mode: 0o600,
    });
    throw new Error(
      `${command} ${args[0]} failed; inspect the isolated run logs`
    );
  }
  return result.stdout;
}

// Bun prints `(fail) name [ms]` per failed test and `N pass` / `N fail` /
// `N skip` totals.
function parseTestOutput(output: string) {
  const total = (label: string) =>
    Number(
      output.match(new RegExp(`(?:^|\\n)\\s*(\\d+) ${label}(?:\\s|$)`))?.[1] ??
        0
    );
  return {
    tests: { pass: total("pass"), fail: total("fail"), skip: total("skip") },
    failedTests: [
      ...new Set(
        [...output.matchAll(/^\(fail\) (.+?)(?: \[[\d.]+m?s\])?$/gm)].map(
          (match) => match[1] ?? ""
        )
      ),
    ],
  };
}

// The journal lands in the artifact, so it gets the same redaction as logs.
function readLifecycleJournal() {
  const path = join(logDirectory, LIFECYCLE_REPORT);
  try {
    let text = readFileSync(path, "utf8");
    for (const secret of [
      boxApiKey,
      redisToken,
      environment.WORKOS_COOKIE_PASSWORD,
    ]) {
      if (secret) {
        text = text.replaceAll(secret, "[redacted]");
      }
    }
    writeFileSync(path, text, { mode: 0o600 });
    return JSON.parse(text) as LifecycleJournalReport;
  } catch {
    // The suite failed before its test body started.
    return null;
  }
}

async function freePort() {
  const listener = createServer();
  await new Promise<void>((accepted, rejected) => {
    listener.once("error", rejected);
    listener.listen(0, "127.0.0.1", accepted);
  });
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((accepted, rejected) =>
    listener.close((error) => (error ? rejected(error) : accepted()))
  );
  return address.port;
}

function start(name: string, args: string[], cwd = root) {
  const child = spawn(process.execPath, ["--no-env-file", ...args], {
    cwd,
    env: environment,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  const log = join(logDirectory, `${name}.log`);
  const capture = (chunk: Buffer) => {
    const text = chunk
      .toString()
      .replaceAll(redisToken, "[redacted]")
      .replaceAll(environment.WORKOS_COOKIE_PASSWORD ?? "", "[redacted]");
    writeFileSync(log, text, { flag: "a", mode: 0o600 });
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  child.on("error", () => {
    childFailed = true;
  });
  child.on("exit", () => {
    childFailed = true;
  });
}

// Long steps (snapshot build, regression suites) run in their own process
// group so a timeout or cancellation also stops everything they started; the
// group is registered for final cleanup.
async function runOwned(
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  cwd = root
) {
  if (stopped) {
    return { status: null, output: "Run interrupted before start" };
  }
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const killGroup = () => {
    try {
      if (child.pid) {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      // ESRCH: the group already exited.
    }
  };
  const closed = new Promise<void>((resolveClose) => {
    child.once("close", () => resolveClose());
  });
  const timer = setTimeout(killGroup, timeoutMs);
  let grace: ReturnType<typeof setTimeout> | undefined;
  cancelActive = () => {
    try {
      if (child.pid) {
        process.kill(-child.pid, "SIGTERM");
      }
    } catch {
      // ESRCH: the group already exited.
    }
    grace = setTimeout(killGroup, 5000);
  };
  const status = await new Promise<number | null>((resolveExit) => {
    child.once("exit", (code) => resolveExit(code));
    child.once("error", () => resolveExit(null));
  });
  clearTimeout(timer);
  clearTimeout(grace);
  cancelActive = undefined;
  // Leftover descendants keep the output pipes open; stop them, then drain.
  killGroup();
  await closed;
  return { status, output };
}

async function waitUntilReady(url: string, redis = false) {
  const deadline = performance.now() + 180_000;
  while (performance.now() < deadline) {
    if (stopped || childFailed) {
      break;
    }
    try {
      const response = await fetch(url, {
        ...(redis
          ? {
              method: "POST",
              headers: {
                Authorization: `Bearer ${redisToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(["PING"]),
            }
          : {}),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      if (stopped || childFailed) {
        break;
      }
    }
    await delay(2000);
  }
  throw new Error("Owned service readiness failed or the run was interrupted");
}

try {
  const allocated = JSON.parse(
    execute(process.execPath, [
      "--no-env-file",
      "scripts/testing/dashboard/postgres.ts",
      "up",
      ...(values["database-regressions"] ? [DATABASE_REGRESSION_PORT] : []),
    ])
  );
  postgresContainer = allocated.container;
  environment.SITES_TEST_DATABASE_URL = allocated.databaseUrl;
  environment.DATABASE_URL = allocated.databaseUrl;
  execute(process.execPath, [
    "--no-env-file",
    "scripts/testing/dashboard/migrate.ts",
  ]);
  execute(process.execPath, [
    "--no-env-file",
    "scripts/testing/dashboard/fixtures.ts",
    "seed",
  ]);
  if (values["database-regressions"]) {
    if (values.box && boxApiKey) {
      report.staleBoxSnapshotsRemoved =
        await sweepStaleTestSnapshots(boxApiKey);
      if (stopped) {
        throw new Error("Interrupted before the Box snapshot was created");
      }
      report.boxSnapshot = {
        ...(await createTestSnapshot(root, directory, boxApiKey, runOwned)),
        deleted: false,
      };
    }
    for (const file of DATABASE_REGRESSION_FILES) {
      if (stopped) {
        throw new Error("Database regressions interrupted");
      }
      const suiteStarted = performance.now();
      const lifecycleSuite = file === BOX_LIFECYCLE_FILE;
      // A journal left by an earlier run in the same --report directory must
      // not stand in for this run's.
      if (lifecycleSuite) {
        rmSync(join(logDirectory, LIFECYCLE_REPORT), { force: true });
      }
      const boxSuite = report.boxSnapshot && lifecycleSuite;
      const result = await runOwned(
        // The suites wrap a 30 s child run in Bun's 5 s default test timeout.
        ["--no-env-file", "test", "--timeout=60000", file],
        {
          ...environment,
          ...(lifecycleSuite
            ? {
                SITES_E2E_LIFECYCLE_REPORT: join(
                  logDirectory,
                  LIFECYCLE_REPORT
                ),
              }
            : {}),
          ...(boxSuite
            ? {
                SITES_E2E_BOX: "1",
                UPSTASH_BOX_API_KEY: boxApiKey,
                SITES_BUILDER_SNAPSHOT_ID: report.boxSnapshot?.snapshotId,
                SITES_E2E_BOX_TOOLCHAIN_VERSION: report.boxSnapshot?.version,
              }
            : {}),
        },
        boxSuite ? 960_000 : 270_000
      );
      const output = result.output
        .replaceAll(boxApiKey || redisToken, "[redacted]")
        .replaceAll(redisToken, "[redacted]")
        .replaceAll(environment.WORKOS_COOKIE_PASSWORD ?? "", "[redacted]");
      const passed =
        result.status === 0 &&
        !/\(skip\)|(?:^|\n)\s*[1-9]\d* skip(?:\s|$)/.test(output);
      const log = join(logDirectory, `${file.replaceAll("/", "_")}.log`);
      writeFileSync(log, output, { mode: 0o600 });
      const outcome = parseTestOutput(output);
      report.databaseRegressions.push({
        file,
        passed,
        durationMs: +(performance.now() - suiteStarted).toFixed(2),
        ...outcome,
        log: relative(logDirectory, log),
      });
      if (lifecycleSuite) {
        report.lifecycle = readLifecycleJournal();
      }
      if (!passed) {
        const journal = lifecycleSuite ? report.lifecycle : null;
        let detail =
          outcome.failedTests.join("; ") ||
          (result.status === null ? "timed out or was stopped" : "");
        if (journal?.failedPhase) {
          detail = `phase "${journal.failedPhase}": ${journal.error?.split("\n")[0]}`;
        } else if (journal?.runningPhase) {
          detail = `stopped during phase "${journal.runningPhase}"`;
        }
        report.errors.push(
          `Database regression failed or skipped: ${file}${detail ? ` (${detail})` : ""}`
        );
        // The CI log shows where it broke without downloading the artifact.
        console.error(
          `--- ${file} (last 60 lines) ---\n${output.split("\n").slice(-60).join("\n")}`
        );
      }
      if (stopped) {
        throw new Error("Database regressions interrupted");
      }
    }
  }
  redisAllocated = true;
  execute("docker", [
    "run",
    "--detach",
    "--name",
    redisContainer,
    "--label",
    `${REDIS_TEST_LABEL}=${REDIS_TEST_LABEL_VALUE}`,
    "--publish",
    "127.0.0.1::6379",
    "redis:7-alpine",
    "redis-server",
    "--save",
    "",
    "--appendonly",
    "no",
    "--maxmemory",
    "64mb",
  ]);
  const redisPort = await freePort();
  environment.SITES_TEST_REDIS_REST_PORT = String(redisPort);
  environment.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${redisPort}`;
  environment.UPSTASH_REDIS_REST_TOKEN = redisToken;
  start("redis-rest", ["scripts/testing/dashboard/redis-rest.ts"]);
  await waitUntilReady(environment.UPSTASH_REDIS_REST_URL, true);
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  environment.APP_URL = origin;
  environment.NEXT_PUBLIC_APP_URL = origin;
  environment.NEXT_PUBLIC_SITE_URL = origin;
  environment.WORKOS_REDIRECT_URI = `${origin}/auth/callback`;
  environment.WORKFLOW_LOCAL_BASE_URL = origin;
  start(
    "dashboard",
    [
      "x",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    join(root, "apps/dashboard")
  );
  await waitUntilReady(`${origin}/__tests/sites`);
  report.checks = JSON.parse(
    execute(process.execPath, [
      "--no-env-file",
      "scripts/testing/dashboard/verify.ts",
      origin,
    ])
  );
  assert.equal(stopped, false);
  assert.equal(childFailed, false);
  report.passed = report.errors.length === 0;
} catch (error) {
  report.errors.push(
    error instanceof Error ? error.message : "Dashboard smoke failed"
  );
} finally {
  const failuresBeforeCleanup = report.errors.length;
  // Every child leads its own process group (detached). Signal the group even
  // when the leader already exited: descendants such as Vite workers outlive it.
  const groups = children.flatMap((child) => (child.pid ? [child.pid] : []));
  const signalGroup = (pid: number, signal: NodeJS.Signals | 0) => {
    try {
      process.kill(-pid, signal);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        report.errors.push(`Failed to signal owned process group ${pid}`);
      }
      return false;
    }
  };
  for (const pid of groups.toReversed()) {
    signalGroup(pid, "SIGTERM");
  }
  await delay(1500);
  for (const pid of groups) {
    signalGroup(pid, "SIGKILL");
  }
  await delay(500);
  for (const pid of groups) {
    if (signalGroup(pid, 0)) {
      report.errors.push(`Owned process group ${pid} survived SIGKILL`);
    }
  }
  for (const container of [
    postgresContainer,
    redisAllocated ? redisContainer : undefined,
  ]) {
    if (!container) {
      continue;
    }
    try {
      if (container === postgresContainer) {
        execute(process.execPath, [
          "--no-env-file",
          "scripts/testing/dashboard/postgres.ts",
          "down",
          container,
        ]);
      } else {
        const inspected = spawnSync(
          "docker",
          [
            "inspect",
            "--format",
            `{{index .Config.Labels "${REDIS_TEST_LABEL}"}}`,
            container,
          ],
          { encoding: "utf8", timeout: 10_000 }
        );
        if (inspected.status === 0) {
          assert.equal(inspected.stdout.trim(), REDIS_TEST_LABEL_VALUE);
          execute("docker", ["rm", "-fv", container]);
        }
      }
      assert.notEqual(
        spawnSync("docker", ["inspect", container], {
          stdio: "ignore",
          timeout: 10_000,
        }).status,
        0
      );
    } catch {
      report.errors.push(`Cleanup failed for owned container ${container}`);
    }
  }
  if (report.boxSnapshot && boxApiKey) {
    try {
      await deleteTestSnapshot(report.boxSnapshot.snapshotId, boxApiKey);
      report.boxSnapshot.deleted = true;
    } catch {
      report.errors.push(
        `Cleanup failed for Box snapshot ${report.boxSnapshot.snapshotId}`
      );
    }
  }
  report.cleanupPassed = report.errors.length === failuresBeforeCleanup;
  // A signal can land after the last `stopped` check, e.g. during verify.
  if (stopped) {
    report.passed = false;
    report.errors.push("Run interrupted by a signal");
  }
  report.durationMs = +(performance.now() - started).toFixed(2);
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed || !report.cleanupPassed) {
    process.exitCode = 1;
  }
}
