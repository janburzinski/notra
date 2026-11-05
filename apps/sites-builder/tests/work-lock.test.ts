import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { lockWorkDir } from "../compiler/utils/work-lock";

let root = "";

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function deadPid() {
  const exited = Bun.spawn(["true"]);
  await exited.exited;
  return exited.pid;
}

test("only one of many overlapping builds gets the lock", async () => {
  root = await mkdtemp(join(tmpdir(), "notra-work-lock-"));
  const lock = join(root, "work.lock");
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => lockWorkDir(lock))
  );
  const won = results.filter((result) => result.status === "fulfilled");
  expect(won).toHaveLength(1);
  for (const result of results) {
    if (result.status === "rejected") {
      expect(String(result.reason)).toContain("Another Notra Sites build");
    }
  }
  await (won[0] as PromiseFulfilledResult<() => Promise<void>>).value();
  await (
    await lockWorkDir(lock)
  )();
});

test("processes racing to take over a crashed build's lock: exactly one wins", async () => {
  root = await mkdtemp(join(tmpdir(), "notra-work-lock-"));
  const lock = join(root, "work.lock");
  await writeFile(lock, String(await deadPid()));
  const script = join(root, "contend.ts");
  await writeFile(
    script,
    `import { lockWorkDir } from ${JSON.stringify(resolve(import.meta.dir, "../compiler/utils/work-lock.ts"))};
try {
  const release = await lockWorkDir(${JSON.stringify(lock)});
  console.log("won");
  await Bun.sleep(400);
  await release();
} catch {
  console.log("lost");
}`
  );
  const runs = Array.from({ length: 6 }, () =>
    Bun.spawn([process.execPath, script], { stdout: "pipe" })
  );
  const outputs = await Promise.all(
    runs.map((run) => new Response(run.stdout).text())
  );
  expect(outputs.map((output) => output.trim()).sort()).toEqual([
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "won",
  ]);
});
