import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { createOctokit } from "@notra/ai/utils/octokit";
import { slugify } from "@notra/utils/slugify";

import {
  GitHubContentBranchConflictError,
  GitHubContentTargetExistsError,
  publishContentDraftPullRequest,
} from "./publish-content-to-github";

const publishParams = {
  contentId: "post-123",
  contentType: "changelog" as const,
  owner: "acme",
  repo: "demo",
  defaultBranch: "main",
  path: "changelogs/release-v1.md",
  title: "Release",
  markdown: "# Release\nInitial content",
};

function makeBranch(sha = "base", path = "", markdown = "") {
  return { sha, path, markdown };
}

function makePullRequest(number: number, branch: string, body = "") {
  return {
    number,
    html_url: `https://github.com/acme/demo/pull/${number}`,
    body,
    state: "open",
    head: { ref: branch, sha: "", repo: { full_name: "acme/demo" } },
  };
}

function createGitHubFixture() {
  const octokit = createOctokit();
  const branches = new Map<string, ReturnType<typeof makeBranch>>();
  const pullRequests = new Map<number, ReturnType<typeof makePullRequest>>();
  const defaultBranchPaths = new Set<string>();
  const unrelatedPaths = new Set<string>();
  let commits = 0;
  let failPullRequestCreation = false;

  octokit.hook.wrap("request", async (_request, options) => {
    const respond = (data: unknown) => ({
      data,
      status: 200,
      headers: {},
      url: options.url,
    });
    const route = `${options.method} ${options.url}`;
    switch (route) {
      case "GET /repos/{owner}/{repo}/git/ref/{ref}": {
        const branch = branches.get(options.ref.slice(6));
        if (options.ref !== "heads/main" && !branch) {
          throw Object.assign(new Error("Not Found"), { status: 404 });
        }
        return respond({
          object: { sha: options.ref === "heads/main" ? "base" : branch?.sha },
        });
      }
      case "GET /repos/{owner}/{repo}/contents/{path}":
        if (defaultBranchPaths.has(options.path)) {
          return respond({ type: "file" });
        }
        throw Object.assign(new Error("Not Found"), { status: 404 });
      case "GET /repos/{owner}/{repo}/pulls": {
        const matches = [...pullRequests.values()].filter(
          (pr) => !options.head || options.head === `acme:${pr.head.ref}`
        );
        return respond(
          matches.map((pr) => ({
            ...pr,
            head: { ...pr.head, sha: branches.get(pr.head.ref)?.sha },
          }))
        );
      }
      case "POST /repos/{owner}/{repo}/git/refs": {
        const name = options.ref.slice(11);
        if (branches.has(name)) {
          throw Object.assign(new Error("Reference already exists"), {
            status: 422,
          });
        }
        branches.set(name, makeBranch());
        return respond({});
      }
      case "GET /repos/{owner}/{repo}/compare/{basehead}": {
        const branch = [...branches.values()].find((entry) =>
          options.basehead.endsWith(entry.sha)
        );
        return respond({
          ahead_by: branch?.path ? 1 : 0,
          files: [
            ...(branch?.path
              ? [{ filename: branch.path, status: "added" }]
              : []),
            ...[...unrelatedPaths].map((filename) => ({
              filename,
              status: "added",
            })),
          ],
        });
      }
      case "POST /graphql": {
        const input = options.variables.input;
        const branch = branches.get(input.branch.branchName);
        if (!branch || branch.sha !== input.expectedHeadOid) {
          throw new Error("Head mismatch");
        }
        const file = input.fileChanges.additions[0];
        commits += 1;
        branches.set(
          input.branch.branchName,
          makeBranch(
            `commit-${commits}`,
            file.path,
            Buffer.from(file.contents, "base64").toString()
          )
        );
        return respond({
          data: {
            createCommitOnBranch: { commit: { oid: `commit-${commits}` } },
          },
        });
      }
      case "POST /repos/{owner}/{repo}/pulls": {
        if (failPullRequestCreation) {
          throw Object.assign(new Error("GitHub unavailable"), { status: 503 });
        }
        const pr = makePullRequest(
          pullRequests.size + 1,
          options.head,
          options.body
        );
        pullRequests.set(pr.number, pr);
        return respond(pr);
      }
      case "GET /repos/{owner}/{repo}/pulls/{pull_number}": {
        const pr = pullRequests.get(options.pull_number);
        if (!pr) {
          throw new Error("Pull request missing");
        }
        return respond({
          ...pr,
          head: { ...pr.head, sha: branches.get(pr.head.ref)?.sha },
        });
      }
      case "PATCH /repos/{owner}/{repo}/pulls/{pull_number}":
        return respond({});
      default:
        throw new Error(`Unexpected request: ${route}`);
    }
  });

  return {
    octokit,
    branches,
    pullRequests,
    defaultBranchPaths,
    unrelatedPaths,
    setFailPullRequestCreation: (fail: boolean) => {
      failPullRequestCreation = fail;
    },
  };
}

describe("publishContentDraftPullRequest", () => {
  test("does not create a branch when the first publication target already exists", async () => {
    const fixture = createGitHubFixture();
    fixture.defaultBranchPaths.add(publishParams.path);
    await expect(
      publishContentDraftPullRequest(fixture.octokit, publishParams)
    ).rejects.toBeInstanceOf(GitHubContentTargetExistsError);
    expect(fixture.branches.size).toBe(0);
    expect(fixture.pullRequests.size).toBe(0);
  });

  test.each(["changelogs/release-v2.md", "docs/releases/release-v1.md"])(
    "keeps the original PR and path after changing the target to %s",
    async (path) => {
      const fixture = createGitHubFixture();
      const first = await publishContentDraftPullRequest(
        fixture.octokit,
        publishParams
      );
      const updated = await publishContentDraftPullRequest(fixture.octokit, {
        ...publishParams,
        path,
        markdown: "Updated content",
      });
      expect(updated).toEqual({ ...first, operation: "updated" });
      expect(fixture.pullRequests.size).toBe(1);
      expect(fixture.branches.get(first.branchName)?.markdown).toBe(
        "Updated content"
      );
    }
  );

  test("reuses a legacy path-hashed PR after changing the slug", async () => {
    const fixture = createGitHubFixture();
    const hash = createHash("sha256")
      .update(`${publishParams.contentId}\0${publishParams.path}`)
      .digest("hex")
      .slice(0, 16);
    const name = `notra/changelog-${slugify(publishParams.path).slice(0, 40)}-${hash}`;
    fixture.branches.set(name, makeBranch("legacy-commit", publishParams.path));
    fixture.pullRequests.set(1, makePullRequest(1, name));
    const result = await publishContentDraftPullRequest(fixture.octokit, {
      ...publishParams,
      path: "changelogs/new-slug.md",
    });
    expect(result.operation).toBe("updated");
    expect(result.branchName).toBe(name);
    expect(result.path).toBe(publishParams.path);
    expect(fixture.pullRequests.size).toBe(1);
  });

  test("recovers the original path after a failed PR creation and slug change", async () => {
    const fixture = createGitHubFixture();
    fixture.setFailPullRequestCreation(true);
    await expect(
      publishContentDraftPullRequest(fixture.octokit, publishParams)
    ).rejects.toThrow();
    fixture.setFailPullRequestCreation(false);
    fixture.defaultBranchPaths.add("changelogs/new-slug.md");
    const result = await publishContentDraftPullRequest(fixture.octokit, {
      ...publishParams,
      path: "changelogs/new-slug.md",
    });
    expect(result.path).toBe(publishParams.path);
    expect(fixture.branches.size).toBe(1);
    expect(fixture.pullRequests.size).toBe(1);
  });

  test("does not overwrite a target that has appeared on the default branch", async () => {
    const fixture = createGitHubFixture();
    const first = await publishContentDraftPullRequest(
      fixture.octokit,
      publishParams
    );
    fixture.defaultBranchPaths.add(publishParams.path);
    await expect(
      publishContentDraftPullRequest(fixture.octokit, {
        ...publishParams,
        path: "changelogs/new-slug.md",
      })
    ).rejects.toBeInstanceOf(GitHubContentTargetExistsError);
    expect(fixture.branches.get(first.branchName)?.markdown).toBe(
      publishParams.markdown
    );
  });

  test("rejects unrelated branch changes before committing", async () => {
    const fixture = createGitHubFixture();
    const first = await publishContentDraftPullRequest(
      fixture.octokit,
      publishParams
    );
    fixture.unrelatedPaths.add("unrelated.md");
    await expect(
      publishContentDraftPullRequest(fixture.octokit, {
        ...publishParams,
        path: "changelogs/new-slug.md",
      })
    ).rejects.toBeInstanceOf(GitHubContentBranchConflictError);
    expect(fixture.branches.get(first.branchName)?.markdown).toBe(
      publishParams.markdown
    );
  });
});
