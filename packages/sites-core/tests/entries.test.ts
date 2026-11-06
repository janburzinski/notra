import { describe, expect, test } from "bun:test";

import {
  parseSiteEntryFile,
  siteEntryPagePath,
  siteEntryTrafficPaths,
} from "../src/utils/entries";

const mounts = { blog: "/news", changelog: "/" };

describe("parseSiteEntryFile", () => {
  test("reads area, slug and format", () => {
    expect(parseSiteEntryFile("blog/2026/launch.mdx")).toEqual({
      area: "blog",
      slug: "2026/launch",
      format: "mdx",
    });
  });

  test("serves index files at their folder", () => {
    expect(parseSiteEntryFile("blog/guides/index.md")?.slug).toBe("guides");
  });

  test("skips non-entries and underscore segments", () => {
    expect(parseSiteEntryFile("docs/launch.mdx")).toBeNull();
    expect(parseSiteEntryFile("blog/_drafts/launch.mdx")).toBeNull();
    expect(parseSiteEntryFile("blog/launch.MDX")).toBeNull();
  });
});

describe("siteEntryPagePath", () => {
  const page = (filePath: string, rootDirectory = "") =>
    siteEntryPagePath({ filePath, rootDirectory, mounts });

  test("joins the area mount and the entry slug", () => {
    expect(page("blog/launch.mdx")).toBe("/news/launch");
    expect(page("docs/blog/2026/launch.md", "/docs/")).toBe(
      "/news/2026/launch"
    );
    expect(page("changelog/v2.mdx")).toBe("/v2");
    expect(page("blog/guides/index.mdx")).toBe("/news/guides");
  });

  test("returns null for files the build doesn't serve", () => {
    expect(page("blog/launch.mdx", "docs")).toBeNull();
    expect(page("blog/Launch Post.mdx")).toBeNull();
    expect(page("blog/_hidden.mdx")).toBeNull();
    expect(
      siteEntryPagePath({
        filePath: "blog/launch.mdx",
        rootDirectory: "",
        mounts: { changelog: "/changelog" },
      })
    ).toBeNull();
  });
});

test("lists the page and its agent-facing copies", () => {
  expect(siteEntryTrafficPaths("/blog/launch")).toEqual([
    "/blog/launch",
    "/blog/launch.md",
    "/blog/launch/index.md",
    "/blog/launch/index.html",
    "/blog/launch/index",
  ]);
});
