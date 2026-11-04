import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("account deletion order, marker and WorkOS webhook backstop", () => {
  const result = spawnSync(
    process.execPath,
    ["--no-env-file", "test", "./tests/fixtures/account-deletion.fixture.ts"],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { PATH: process.env.PATH, DATABASE_URL: "" },
      timeout: 90_000,
    }
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 95_000);

test("post-deletion cleanup keeps going when one step fails", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "test",
      "./tests/fixtures/finish-user-deletion.fixture.ts",
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { PATH: process.env.PATH, DATABASE_URL: "" },
      timeout: 60_000,
    }
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 65_000);
