import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import { cleanupRailwaySandbox } from "./utils/cleanup.mjs";

const execute = promisify(execFile);
const path = process.argv[2];
if (!path) {
  throw new Error(
    "Usage: node scripts/testing/railway/cleanup.mjs OWNED_LEDGER_JSON"
  );
}
const ledger = JSON.parse(await readFile(path, "utf8"));
const started = performance.now();
const run = async (args) => {
  const { stdout } = process.env.SITES_E2E_RAILWAY_CLI
    ? await execute(process.env.SITES_E2E_RAILWAY_CLI, args, {
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
      })
    : await execute("npx", ["--yes", "@railway/cli@5.63.4", ...args], {
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
      });
  return stdout;
};
const result = await cleanupRailwaySandbox(ledger, run);
ledger.cleanup = {
  ...result,
  durationMs: performance.now() - started,
  confirmedAt: new Date().toISOString(),
};
await writeFile(path, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(ledger.cleanup, null, 2));
