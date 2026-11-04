import { describe, expect, test } from "bun:test";

import {
  detectBlogDirectory,
  integrationBlogDirectory,
} from "./autopilot-blog";

const none = { setting: null, integration: null };

describe("detectBlogDirectory", () => {
  test("finds the blog folder inside a monorepo workspace", () => {
    const paths = [
      "package.json",
      "apps/web/package.json",
      "apps/web/src/content/blog/first-post.mdx",
      "apps/web/src/content/blog/second-post.mdx",
      "apps/web/public/blog/first-post.png",
      "packages/ui/README.md",
    ];
    expect(detectBlogDirectory(paths, none)).toBe("apps/web/src/content/blog");
  });

  test("prefers the folder with the most posts over a stray root post", () => {
    const paths = [
      "content/blog/misplaced.md",
      "apps/web/src/content/blog/a.mdx",
      "apps/web/src/content/blog/b.mdx",
    ];
    expect(detectBlogDirectory(paths, none)).toBe("apps/web/src/content/blog");
  });

  test("picks the same folder whatever the tree order", () => {
    const paths = [
      "packages/site/content/blog/a.md",
      "apps/web/content/blog/a.md",
      "apps/docs/blog/a.md",
    ];
    const expected = "apps/web/content/blog";
    expect(detectBlogDirectory(paths, none)).toBe(expected);
    expect(detectBlogDirectory([...paths].reverse(), none)).toBe(expected);
  });

  test("keeps finding root blog folders", () => {
    const paths = ["README.md", "src/content/blog/hello.mdx", "src/index.ts"];
    expect(detectBlogDirectory(paths, none)).toBe("src/content/blog");
  });

  test("ignores hinted folders deeper than a workspace", () => {
    const paths = ["apps/builder/fixtures/acme/blog/post.md"];
    expect(detectBlogDirectory(paths, none)).toBe("content/blog");
  });

  test("the Autopilot setting wins over everything else", () => {
    const paths = ["apps/web/src/content/blog/a.mdx"];
    expect(
      detectBlogDirectory(paths, {
        setting: "/site/posts/",
        integration: "apps/web/src/content/blog",
      })
    ).toBe("site/posts");
  });

  test("falls back to the GitHub publishing folder before detection", () => {
    const paths = ["content/blog/a.md"];
    expect(
      detectBlogDirectory(paths, {
        setting: null,
        integration: "apps/web/src/content/blog",
      })
    ).toBe("apps/web/src/content/blog");
  });

  test("skips an unsafe setting", () => {
    expect(
      detectBlogDirectory([], { setting: "../outside", integration: null })
    ).toBe("content/blog");
  });
});

describe("integrationBlogDirectory", () => {
  test("takes the folder from the content file path", () => {
    expect(
      integrationBlogDirectory({
        contentPath: "apps/web/src/content/blog/:slug.mdx",
      })
    ).toBe("apps/web/src/content/blog");
    expect(
      integrationBlogDirectory({ contentPath: "blog/:slug/index.md" })
    ).toBe("blog");
  });

  test("uses the publishing folder without a content file path", () => {
    expect(integrationBlogDirectory({ directory: "website/posts" })).toBe(
      "website/posts"
    );
  });

  test("returns null when nothing usable is set", () => {
    expect(integrationBlogDirectory(null)).toBeNull();
    expect(integrationBlogDirectory({ directory: "" })).toBeNull();
    expect(integrationBlogDirectory({ contentPath: ":slug.md" })).toBeNull();
  });
});
