import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("the OpenAPI document marks publishDestination as deprecated everywhere", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "--eval",
      `
import assert from "node:assert/strict";
const { app } = await import(${JSON.stringify(fileURLToPath(new URL("../src/index.ts", import.meta.url)))});
const doc = await (await app.request("/openapi.json")).json();
const fields = [];
const walk = (node) => {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "publishDestination") fields.push(value);
    walk(value);
  }
};
walk(doc);
assert.ok(fields.length >= 4, "schedule and event trigger schemas expose the field");
for (const field of fields) {
  assert.equal(field.deprecated, true);
  assert.match(field.description, /^Deprecated and ignored\\./);
}
`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        PATH: process.env.PATH,
        UNKEY_ROOT_KEY: "fixture",
        DATABASE_URL: "postgresql://fixture@127.0.0.1:1/fixture",
        UPSTASH_REDIS_REST_URL: "https://redis.invalid",
        UPSTASH_REDIS_REST_TOKEN: "fixture",
        WORKFLOW_BASE_URL: "https://workflow.invalid",
        INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
        QSTASH_TOKEN: "fixture",
        AUTUMN_SECRET_KEY: "fixture",
      },
      timeout: 60_000,
      encoding: "utf8",
    }
  );
  expect(result.status, result.stderr).toBe(0);
});
