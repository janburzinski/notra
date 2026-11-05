import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SiteBuildRequest } from "@notra/sites-core/types/build";

import {
  assertOutsideSource,
  localBuildTarget,
  localDefaultConfig,
  localMounts,
  parseMountFlags,
} from "../compiler/utils/local-options";

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

test("--mount parses, normalizes and is optional", () => {
  expect(parseMountFlags(["blog=/news/", "changelog=/Releases"])).toEqual({
    blog: "/news",
    changelog: "/releases",
  });
  expect(parseMountFlags()).toBeUndefined();
});

test.each([
  [["blog"], "expected blog=<path> or changelog=<path>"],
  [["docs=/docs"], "expected blog=<path> or changelog=<path>"],
  [["blog=newsroom"], "the path must start with /"],
  [["blog=/a", "blog=/b"], "blog is mounted twice"],
  [["blog=/news", "changelog=/news/releases"], "may not be nested"],
])("--mount %p is rejected", (flags, message) => {
  expect(() => parseMountFlags(flags)).toThrow(message);
});

test("--mount serves only the listed sections, replaces a target's mounts and must include --area", async () => {
  const root = await site("blog", "changelog");
  const target = { mounts: { blog: "/blog" } } as SiteBuildRequest;
  expect(localMounts(root, target, undefined, { changelog: "/" })).toEqual({
    changelog: "/",
  });
  expect(() =>
    localMounts(root, undefined, "changelog", { blog: "/newsroom" })
  ).toThrow("--area changelog needs a --mount changelog=<path>");
});

test("a build without a target is a local, noindex build of the site's sections", async () => {
  const root = await site("changelog");
  expect(localBuildTarget(root, undefined, {})).toMatchObject({
    siteId: "local",
    publicOrigin: "http://localhost",
    mounts: { changelog: "/changelog" },
    noindex: true,
    includeDrafts: false,
    defaultConfig: localDefaultConfig(root),
  });
  expect(
    localBuildTarget(root, undefined, {
      origin: "https://example.com/ignored/path",
    }).publicOrigin
  ).toBe("https://example.com");
  for (const origin of ["ftp://example.com", "not a url"]) {
    expect(() => localBuildTarget(root, undefined, { origin })).toThrow(
      "expected an http(s) URL"
    );
  }
});

test("--origin and --mount replace those fields of a target and keep the rest", async () => {
  const target = {
    siteId: "site_fixture",
    publicOrigin: "https://acme.example.com",
    mounts: { blog: "/blog", changelog: "/changelog" },
    noindex: false,
  } as SiteBuildRequest;
  const root = await site("blog");
  expect(localBuildTarget(root, target, {})).toEqual(target);
  expect(
    localBuildTarget(root, target, {
      origin: "http://localhost:8080",
      mounts: { blog: "/newsroom" },
    })
  ).toEqual({
    ...target,
    publicOrigin: "http://localhost:8080",
    mounts: { blog: "/newsroom" },
  });
});

test("--out may not hold the site source", () => {
  const root = join(tmpdir(), "site");
  for (const out of [root, tmpdir()]) {
    expect(() => assertOutsideSource(root, out)).toThrow(
      "holds the site source"
    );
  }
  for (const out of [
    join(root, ".notra", "out"),
    join(tmpdir(), "site-out"),
    join(tmpdir(), "..site"),
  ]) {
    expect(() => assertOutsideSource(root, out)).not.toThrow();
  }
});
