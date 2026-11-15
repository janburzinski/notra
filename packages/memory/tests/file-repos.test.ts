import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileRepos } from "../src/stores/file-repos";
import { RepoConflictError } from "../src/utils/errors";

const author = { name: "Test", email: "test@example.invalid" };
const dirs: string[] = [];
function storePath() {
  const dir = mkdtempSync(join(tmpdir(), "notra-file-repos-"));
  dirs.push(dir);
  return join(dir, "repos.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps every version and rejects a write on a moved head", async () => {
  const store = createFileRepos(storePath());
  const first = await store.create("r", {
    message: "Create",
    author,
    files: { "artifact.md": "one" },
  });
  const second = await store.commit("r", {
    expectedHeadSha: first,
    message: "Update",
    author,
    files: { "artifact.md": "two" },
  });
  expect(await store.read("r", "artifact.md", first)).toBe("one");
  expect(await store.read("r", "artifact.md", second)).toBe("two");
  expect(await store.head("r")).toBe(second);
  await expect(
    store.commit("r", {
      expectedHeadSha: first,
      message: "Stale",
      author,
      files: { "artifact.md": "lost" },
    })
  ).rejects.toBeInstanceOf(RepoConflictError);
  await store.deleteRepo("r");
  expect(await store.head("r")).toBeNull();
});

test("processes writing at once never lose each other's repositories", async () => {
  const path = storePath();
  const script = join(path, "..", "writer.ts");
  writeFileSync(
    script,
    `const { createFileRepos } = await import(${JSON.stringify(join(import.meta.dir, "../src/stores/file-repos.ts"))});
const store = createFileRepos(${JSON.stringify(path)});
const author = { name: "Test", email: "test@example.invalid" };
await Promise.all(Array.from({ length: 25 }, (_, i) =>
  store.create(process.argv[2] + "-" + i, { message: "Create", author, files: { "a.md": "x" } })));`
  );
  const codes = await Promise.all(
    ["a", "b", "c", "d"].map(
      (name) => Bun.spawn([process.execPath, script, name]).exited
    )
  );
  expect(codes).toEqual([0, 0, 0, 0]);
  const repos = JSON.parse(await Bun.file(path).text());
  expect(Object.keys(repos)).toHaveLength(100);
  expect(existsSync(`${path}.lock`)).toBe(false);
});

test("a lock left by a crashed process is taken over", async () => {
  const path = storePath();
  writeFileSync(`${path}.lock`, "");
  const old = new Date(Date.now() - 60_000);
  utimesSync(`${path}.lock`, old, old);
  const store = createFileRepos(path);
  await store.create("r", {
    message: "Create",
    author,
    files: { "a.md": "x" },
  });
  expect(await store.head("r")).not.toBeNull();
});
