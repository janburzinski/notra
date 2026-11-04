import { expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { S3Client } from "@aws-sdk/client-s3";

// r2.ts caches its client and settings for the process, so the synthetic ones
// stay in a child process instead of leaking into later `bun test ./src` files.
if (process.env.NOTRA_R2_TEST_CHILD === "1") {
  spyOn(S3Client.prototype, "send").mockImplementation((async () => ({
    Errors: [{ Key: "b", Code: "InternalError" }],
  })) as unknown as S3Client["send"]);
  const { deleteR2Keys } = await import("./r2");

  test("deleteR2Keys reports keys R2 refused to delete", async () => {
    await expect(deleteR2Keys(["a", "b"])).rejects.toThrow(
      "Failed to delete R2 objects: b"
    );
  });
} else {
  test("deleteR2Keys reports keys R2 refused to delete (isolated)", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          NOTRA_R2_TEST_CHILD: "1",
          CLOUDFLARE_ACCESS_KEY_ID: "synthetic",
          CLOUDFLARE_SECRET_ACCESS_KEY: "synthetic",
          CLOUDFLARE_BUCKET_NAME: "synthetic",
          CLOUDFLARE_S3_ENDPOINT: "https://r2.example.test",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stdout + child.stderr).toBe(0);
  }, 25_000);
}
