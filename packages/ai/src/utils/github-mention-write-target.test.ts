import { describe, expect, test } from "bun:test";

import type {
  GitHubMentionContext,
  GitHubMentionOctokit,
  GitHubMentionWriteState,
} from "@notra/ai/types/github-mention";

import {
  ensureFollowUpPullRequest,
  resolveGitHubMentionWriteTarget,
} from "./github-mention-write-target";

function fakeOctokit(head: {
  ref: string;
  repoFullName: string | null;
  sha?: string;
  state?: "open" | "closed";
  merged?: boolean;
}) {
  return {
    request: async () => ({
      data: {
        number: 7,
        title: "docs",
        body: null,
        html_url: "https://github.com/acme/app/pull/7",
        head: {
          ref: head.ref,
          sha: head.sha ?? "abc123",
          repo: head.repoFullName ? { full_name: head.repoFullName } : null,
        },
        base: { ref: "release", repo: { default_branch: "main" } },
        draft: false,
        state: head.state ?? "open",
        merged: head.merged ?? false,
      },
    }),
  } as unknown as GitHubMentionOctokit;
}

function context(
  mode: GitHubMentionContext["destination"]["mode"]
): GitHubMentionContext {
  return {
    owner: "acme",
    repo: "app",
    defaultBranch: "main",
    issueNumber: 7,
    comment: { id: 1, body: "@notra-ai fix", htmlUrl: "", review: null },
    destination: {
      mode,
      pullRequestNumber: 7,
      headRef: "main",
      headSha: "abc123",
    },
  } as GitHubMentionContext;
}

const emptyState = (): GitHubMentionWriteState => ({
  writeBranch: null,
  writePullNumber: null,
  writePullRequestUrl: null,
});

describe("resolveGitHubMentionWriteTarget", () => {
  test("refuses to commit when the pull request head is the default branch", async () => {
    await expect(
      resolveGitHubMentionWriteTarget({
        octokit: fakeOctokit({ ref: "main", repoFullName: "acme/app" }),
        context: context("same_pull_request"),
        state: emptyState(),
      })
    ).rejects.toThrow("default branch");
  });

  test("refuses to commit to fork pull requests", async () => {
    await expect(
      resolveGitHubMentionWriteTarget({
        octokit: fakeOctokit({ ref: "fix-docs", repoFullName: "someone/app" }),
        context: context("same_pull_request"),
        state: emptyState(),
      })
    ).rejects.toThrow("Fork");
  });

  test("refuses to write from a closed or merged pull request", async () => {
    for (const lifecycle of [
      { state: "closed" as const, merged: false },
      { state: "closed" as const, merged: true },
    ]) {
      await expect(
        resolveGitHubMentionWriteTarget({
          octokit: fakeOctokit({
            ref: "docs",
            repoFullName: "acme/app",
            ...lifecycle,
          }),
          context: context("same_pull_request"),
          state: emptyState(),
        })
      ).rejects.toThrow("closed pull request");
    }
  });

  test("refuses to create a follow-up branch from a moved source head", async () => {
    const initial = context("new_pull_request");
    initial.destination.headSha = "read-before-manual-push";
    await expect(
      resolveGitHubMentionWriteTarget({
        octokit: fakeOctokit({
          ref: "docs",
          repoFullName: "acme/app",
          sha: "manual-push",
        }),
        context: initial,
        state: emptyState(),
      })
    ).rejects.toThrow("changed");
  });

  test("keeps the revision read by the agent even when the remote head moves", async () => {
    const initial = context("same_pull_request");
    initial.destination.headSha = "read-before-manual-push";
    const target = await resolveGitHubMentionWriteTarget({
      octokit: fakeOctokit({ ref: "docs", repoFullName: "acme/app" }),
      context: initial,
      state: emptyState(),
    });
    expect(target.expectedHeadOid).toBe("read-before-manual-push");
    const subsequent = await resolveGitHubMentionWriteTarget({
      octokit: fakeOctokit({ ref: "docs", repoFullName: "acme/app" }),
      context: initial,
      state: { ...emptyState(), commitSha: "this-runs-commit" },
    });
    expect(subsequent.expectedHeadOid).toBe("this-runs-commit");
  });
});

describe("ensureFollowUpPullRequest", () => {
  function recordingOctokit(options: { failPatch?: boolean } = {}) {
    const calls: { route: string; params: Record<string, unknown> }[] = [];
    const octokit = {
      request: async (route: string, params: Record<string, unknown>) => {
        calls.push({ route, params });
        if (route.startsWith("PATCH") && options.failPatch) {
          throw new Error("rename failed");
        }
        return {
          data: {
            number: 8,
            html_url: "https://github.com/acme/app/pull/8",
            head: { ref: "notra/mention-7-issue-1", sha: "def456" },
          },
        };
      },
    } as unknown as GitHubMentionOctokit;
    return { octokit, calls };
  }

  function followUpContext() {
    const value = context("new_pull_request");
    value.destination.headRef = "feat/export";
    value.sender = { id: 1, login: "jan", type: "User" };
    value.comment.htmlUrl = "https://github.com/acme/app/pull/7#issuecomment-1";
    return value;
  }

  test("opens the draft with the agent's title and links the comment", async () => {
    const { octokit, calls } = recordingOctokit();
    const state = emptyState();
    await ensureFollowUpPullRequest({
      octokit,
      context: followUpContext(),
      state,
      branch: "notra/mention-7-issue-1",
      title: "docs(blog): announce faster exports",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.params).toMatchObject({
      title: "docs(blog): announce faster exports",
      base: "feat/export",
      draft: true,
    });
    expect(String(calls[0]?.params.body)).toContain(
      "[@jan's comment](https://github.com/acme/app/pull/7#issuecomment-1)"
    );
    expect(state.writePullNumber).toBe(8);
    expect(state.writePullRequestTitle).toBe(
      "docs(blog): announce faster exports"
    );
  });

  test("falls back to the default title without one", async () => {
    const { octokit, calls } = recordingOctokit();
    await ensureFollowUpPullRequest({
      octokit,
      context: followUpContext(),
      state: emptyState(),
      branch: "notra/mention-7-issue-1",
    });
    expect(calls[0]?.params.title).toBe(
      "docs: follow-up from @notra mention on #7"
    );
  });

  test("renames an open draft only when the title changes", async () => {
    const { octokit, calls } = recordingOctokit();
    const state = {
      ...emptyState(),
      writePullNumber: 8,
      writePullRequestUrl: "https://github.com/acme/app/pull/8",
      writePullRequestTitle: "docs: follow-up from @notra mention on #7",
    };
    const params = {
      octokit,
      context: followUpContext(),
      state,
      branch: "notra/mention-7-issue-1",
    };
    await ensureFollowUpPullRequest(params);
    expect(calls).toHaveLength(0);
    await ensureFollowUpPullRequest({
      ...params,
      title: "docs(blog): exports",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.route).toStartWith("PATCH");
    expect(state.writePullRequestTitle).toBe("docs(blog): exports");
    await ensureFollowUpPullRequest({
      ...params,
      title: "docs(blog): exports",
    });
    expect(calls).toHaveLength(1);
  });

  test("keeps going when the rename fails", async () => {
    const { octokit } = recordingOctokit({ failPatch: true });
    const state = {
      ...emptyState(),
      writePullNumber: 8,
      writePullRequestUrl: "https://github.com/acme/app/pull/8",
    };
    const result = await ensureFollowUpPullRequest({
      octokit,
      context: followUpContext(),
      state,
      branch: "notra/mention-7-issue-1",
      title: "docs(blog): exports",
    });
    expect(result?.number).toBe(8);
    expect(state.writePullRequestTitle).toBeUndefined();
  });

  test("does nothing outside separate pull request mode", async () => {
    const { octokit, calls } = recordingOctokit();
    const result = await ensureFollowUpPullRequest({
      octokit,
      context: context("same_pull_request"),
      state: emptyState(),
      branch: "docs",
      title: "ignored",
    });
    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
