import type {
  GitHubMentionContext,
  GitHubMentionOctokit,
  GitHubMentionWriteState,
  GitHubMentionWriteTarget,
} from "@notra/ai/types/github-mention";
import {
  createDraftPullRequest,
  createGitHubBranch,
  getGitHubBranchHeadSha,
  getPullRequestHead,
  updatePullRequestTitle,
} from "@notra/ai/utils/github-pr-commit";

function followUpBranchName(context: GitHubMentionContext) {
  const kind = context.comment.review ? "review" : "issue";
  return `notra/mention-${context.issueNumber}-${kind}-${context.comment.id}`;
}

export async function resolveGitHubMentionWriteTarget(params: {
  octokit: GitHubMentionOctokit;
  context: GitHubMentionContext;
  state: GitHubMentionWriteState;
}): Promise<GitHubMentionWriteTarget> {
  const { octokit, context, state } = params;
  if (
    context.destination.mode === "reply_only" ||
    !context.destination.headRef ||
    !context.destination.pullRequestNumber
  ) {
    throw new Error(
      "This mention is not on a pull request, so files cannot be committed."
    );
  }

  const head = await getPullRequestHead({
    octokit,
    owner: context.owner,
    repo: context.repo,
    pullNumber: context.destination.pullRequestNumber,
  });
  if (head.state !== "open" || head.merged) {
    throw new Error("Files cannot be committed to a closed pull request.");
  }
  const headIsFork =
    head.headRepoFullName?.toLowerCase() !==
    `${context.owner}/${context.repo}`.toLowerCase();

  if (headIsFork) {
    throw new Error("Fork pull requests are not supported for content writes.");
  }
  const expectedHeadOid = state.commitSha ?? context.destination.headSha;
  if (!expectedHeadOid) {
    throw new Error("Cannot write without the revision read by the agent.");
  }

  if (context.destination.mode === "same_pull_request") {
    if (head.headRef === context.defaultBranch) {
      throw new Error(
        `This pull request's head is the default branch (${context.defaultBranch}). Notra never commits to it; ask for a separate pull request instead.`
      );
    }
    return {
      branch: head.headRef,
      expectedHeadOid,
      pullNumber: head.number,
      pullRequestUrl: head.htmlUrl,
    };
  }

  const branch = state.writeBranch ?? followUpBranchName(context);
  if (state.writeBranch == null) {
    if (head.headSha !== expectedHeadOid) {
      throw new Error(
        "The pull request changed; read it again before opening a follow-up pull request."
      );
    }
    await createGitHubBranch({
      octokit,
      owner: context.owner,
      repo: context.repo,
      branch,
      sha: expectedHeadOid,
    });
    state.writeBranch = branch;
  }

  const actualHeadOid = await getGitHubBranchHeadSha({
    octokit,
    owner: context.owner,
    repo: context.repo,
    branch,
  });
  if (actualHeadOid !== expectedHeadOid) {
    throw new Error(
      "The follow-up branch changed; read it again before editing."
    );
  }

  return {
    branch,
    expectedHeadOid,
    pullNumber: state.writePullNumber ?? context.destination.pullRequestNumber,
    pullRequestUrl:
      state.writePullRequestUrl ??
      context.pullRequest?.htmlUrl ??
      `https://github.com/${context.owner}/${context.repo}/pull/${context.destination.pullRequestNumber}`,
  };
}

function defaultFollowUpTitle(context: GitHubMentionContext) {
  return `docs: follow-up from @notra mention on #${context.issueNumber}`;
}

export async function ensureFollowUpPullRequest(params: {
  octokit: GitHubMentionOctokit;
  context: GitHubMentionContext;
  state: GitHubMentionWriteState;
  branch: string;
  /** Title the agent asked for; renames the pull request if it already exists. */
  title?: string | null;
}) {
  const { context, state } = params;
  if (context.destination.mode !== "new_pull_request") {
    return null;
  }
  const title = params.title?.trim() || null;
  if (state.writePullNumber && state.writePullRequestUrl) {
    if (title && title !== state.writePullRequestTitle) {
      // The commit already landed; a missed rename only leaves the old title.
      const renamed = await updatePullRequestTitle({
        octokit: params.octokit,
        owner: context.owner,
        repo: context.repo,
        pullNumber: state.writePullNumber,
        title,
      }).then(
        () => true,
        () => false
      );
      if (renamed) {
        state.writePullRequestTitle = title;
      }
    }
    return {
      number: state.writePullNumber,
      htmlUrl: state.writePullRequestUrl,
    };
  }

  const base = context.destination.headRef;
  if (!base) {
    throw new Error(
      "Cannot open a follow-up pull request without a base branch"
    );
  }

  const requestedIn = context.comment.htmlUrl
    ? `[@${context.sender.login}'s comment](${context.comment.htmlUrl})`
    : `a comment by @${context.sender.login}`;
  const pullRequest = await createDraftPullRequest({
    octokit: params.octokit,
    owner: context.owner,
    repo: context.repo,
    title: title ?? defaultFollowUpTitle(context),
    body: `Opened by Notra for ${requestedIn} on #${context.issueNumber}, which asked for a separate pull request.`,
    head: params.branch,
    base,
  });
  state.writePullNumber = pullRequest.number;
  state.writePullRequestUrl = pullRequest.htmlUrl;
  state.writePullRequestTitle = title;
  return pullRequest;
}
