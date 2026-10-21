import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("standalone API artifact loads native dependencies before validating configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "notra-api-production-"));
  try {
    cpSync(new URL("../dist", import.meta.url), join(directory, "dist"), {
      recursive: true,
    });
    const result = spawnSync(
      process.execPath,
      [join(directory, "dist/index.mjs")],
      {
        cwd: directory,
        env: { NODE_ENV: "production" },
        encoding: "utf8",
        timeout: 10_000,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing required environment variables:");
    expect(result.stderr).not.toContain("Cannot find");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
