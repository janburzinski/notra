import { describe, expect, test } from "bun:test";

import type { GitHubMentionOctokit } from "@notra/ai/types/github-mention";

import { findExistingRepositoryPaths } from "./github-pr-commit";

function octokitWith(files: Record<string, number>) {
  const requested: string[] = [];
  const octokit = {
    request: async (_route: string, params: { path: string }) => {
      requested.push(params.path);
      const status = files[params.path] ?? 404;
      if (status === 200) {
        return { data: { type: "file" } };
      }
      throw Object.assign(new Error(`HTTP ${status}`), { status });
    },
  } as unknown as GitHubMentionOctokit;
  return { octokit, requested };
}

const location = { owner: "acme", repo: "app", ref: "abc123" };

describe("findExistingRepositoryPaths", () => {
  test("returns only the paths that exist, once each", async () => {
    const { octokit, requested } = octokitWith({
      "content/blog/exports.md": 200,
    });
    const existing = await findExistingRepositoryPaths({
      ...location,
      octokit,
      paths: [
        "content/blog/exports.md",
        "public/og/exports.png",
        "content/blog/exports.md",
      ],
    });
    expect(existing).toEqual(["content/blog/exports.md"]);
    expect(requested).toHaveLength(2);
  });

  test("rethrows errors other than not found", async () => {
    const { octokit } = octokitWith({ "content/blog/exports.md": 403 });
    await expect(
      findExistingRepositoryPaths({
        ...location,
        octokit,
        paths: ["content/blog/exports.md"],
      })
    ).rejects.toThrow("HTTP 403");
  });
});
