import { describe, expect, test } from "bun:test";

import type { GeoPromptGapRow } from "@notra/geo-core/types/geo";

import {
  describePromptGap,
  detectBlogDirectory,
  integrationBlogDirectory,
  interleave,
  promptGapDropReason,
} from "./autopilot-blog";

const none = { setting: null, integration: null };

describe("keyword candidates", () => {
  test("search gaps get a turn instead of queuing behind every prompt gap", () => {
    expect(interleave(["p1", "p2", "p3"], ["s1"])).toEqual([
      "p1",
      "s1",
      "p2",
      "p3",
    ]);
    expect(interleave([], ["s1", "s2"])).toEqual(["s1", "s2"]);
    expect(interleave(["p1", "p2"], [], ["a1", "a2"])).toEqual([
      "p1",
      "a1",
      "p2",
      "a2",
    ]);
  });

  test("a prompt gap says where the brand is missing and what people searched", () => {
    const gap = {
      prompt: "best serverless gpu for llms",
      engines: ["chatgpt", "google_ai_overview"],
      mentionedEngines: ["perplexity"],
      engineCoverage: 3,
      ownMentionRate: 1 / 3,
      competitors: ["Modal", "Runpod", "Replicate", "Baseten"],
      searchQueries: ["serverless gpu llm", "cheapest gpu inference", "x"],
    } as GeoPromptGapRow;
    expect(describePromptGap(gap)).toBe(
      'AI engines answer "best serverless gpu for llms" without you on 2 of 3 engines (33% mention you), while Modal, Runpod, Replicate show up. They searched for "serverless gpu llm", "cheapest gpu inference".'
    );
    expect(describePromptGap({ ...gap, searchQueries: [] })).not.toContain(
      "searched"
    );
    // A workspace that tracks no competitors still has who the answers named.
    const untracked = {
      ...gap,
      competitors: [],
      discoveredCompetitors: ["Modal"],
    };
    expect(promptGapDropReason(untracked)).toBeNull();
    expect(describePromptGap(untracked)).toContain("while Modal show up");
  });
});

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
