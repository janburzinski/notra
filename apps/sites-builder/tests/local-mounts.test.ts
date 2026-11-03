import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SiteBuildRequest } from "@notra/sites-core/types/build";

import { localMounts } from "../compiler/utils/local-options";

const roots: string[] = [];

async function site(...folders: string[]) {
  const root = await mkdtemp(join(tmpdir(), "notra-local-mounts-test-"));
  roots.push(root);
  for (const folder of folders) {
    await mkdir(join(root, folder));
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

test.each([
  [["blog"], { blog: "/blog" }],
  [["changelog"], { changelog: "/changelog" }],
  [["blog", "changelog"], { blog: "/blog", changelog: "/changelog" }],
  [[], { blog: "/blog", changelog: "/changelog" }],
])("folders %p preview %p", async (folders, mounts) => {
  expect(localMounts(await site(...folders))).toEqual(mounts);
});

test("a build target keeps its own mounts", async () => {
  const target = { mounts: { blog: "/" } } as SiteBuildRequest;
  expect(localMounts(await site("blog", "changelog"), target)).toEqual({
    blog: "/",
  });
});

test("a file named like a section is not a section", async () => {
  const root = await site("changelog");
  await writeFile(join(root, "blog"), "not a folder");
  expect(localMounts(root)).toEqual({ changelog: "/changelog" });
});

test("--area serves the requested section even without its folder", async () => {
  expect(localMounts(await site("blog"), undefined, "changelog")).toEqual({
    blog: "/blog",
    changelog: "/changelog",
  });
});

test("a source that is a file previews both sections", async () => {
  const root = await site();
  const file = join(root, "site.txt");
  await writeFile(file, "");
  expect(localMounts(file)).toEqual({ blog: "/blog", changelog: "/changelog" });
});
