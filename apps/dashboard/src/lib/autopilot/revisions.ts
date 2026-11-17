import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { listGitHubAppInstallationsByOrganization } from "@notra/ai/integrations/github";
import type { GitHubMentionContext } from "@notra/ai/types/github-mention";
import { findContentPublicationForPullRequest } from "@notra/ai/utils/content-publication";
import { getGitHubMentionAppHandles } from "@notra/ai/utils/github-mention";
import { findGitHubIntegrationForMention } from "@notra/ai/utils/github-mention-auth";
import { postGitHubIssueComment } from "@notra/ai/utils/github-pr-comments";
import { getPullRequestHead } from "@notra/ai/utils/github-pr-commit";
import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { AUTOPILOT_BRANCH_PREFIX } from "@/constants/autopilot";
import {
  AUTOPILOT_REVISION_DELIVERY_PREFIX,
  AUTOPILOT_REVISION_MAX_COMMENTS,
} from "@/constants/autopilot-revisions";
import { pullRequestRef } from "@/lib/autopilot/findings";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import type {
  AutopilotRevisionComment,
  AutopilotRevisionConversation,
} from "@/types/autopilot-revisions";
import type {
  AutopilotOctokit,
  AutopilotPullRequestRef,
} from "@/types/autopilot-runtime";
import {
  buildRevisionRequestBody,
  isRevisionWorking,
  openRevisionRequests,
  parseRevisionComment,
} from "@/utils/autopilot-revisions";

async function loadFindingWithPullRequest(
  organizationId: string,
  findingId: string
) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  const ref = finding ? pullRequestRef(finding) : null;
  if (!(finding && ref)) {
    throw new Error("This item has no pull request");
  }
  return { finding, ref };
}

/** Notra's GitHub App, which posts the requests and the agent's replies. */
function appLogins() {
  return getGitHubMentionAppHandles().map((handle) => `${handle}[bot]`);
}

/** GitHub's comment lists page by 100, oldest first. Enough pages for any real thread. */
const COMMENT_PAGE_SIZE = 100;
const MAX_COMMENT_PAGES = 10;

interface RawComment {
  id: number | bigint;
  body?: string | null;
  user?: { login: string } | null;
  created_at: string;
  html_url: string;
}

/** Every page of one comment list, so the newest comments are never cut off. */
async function listAllComments(
  load: (page: number) => Promise<{ data: RawComment[] }>
) {
  const comments: RawComment[] = [];
  for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
    // Pages depend on each other: a short page means there is no next one.
    const { data } = await load(page);
    comments.push(...data);
    if (data.length < COMMENT_PAGE_SIZE) {
      break;
    }
  }
  return comments;
}

/**
 * The pull request's comments in order. The agent answers a commit inline on
 * the changed file, so review comments count as much as the conversation.
 */
async function listComments(
  octokit: AutopilotOctokit,
  ref: AutopilotPullRequestRef
): Promise<AutopilotRevisionComment[]> {
  const route = {
    owner: ref.owner,
    repo: ref.repo,
    per_page: COMMENT_PAGE_SIZE,
    headers: GITHUB_API_VERSION_HEADERS,
  };
  const [issue, review] = await Promise.all([
    listAllComments((page) =>
      octokit.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { ...route, page, issue_number: ref.pullNumber }
      )
    ),
    listAllComments((page) =>
      octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        { ...route, page, pull_number: ref.pullNumber }
      )
    ),
  ]);
  const logins = appLogins();
  return [...issue, ...review]
    .map((comment) =>
      parseRevisionComment(
        {
          id: Number(comment.id),
          body: comment.body ?? "",
          authorLogin: comment.user?.login ?? "ghost",
          createdAt: comment.created_at,
          htmlUrl: comment.html_url,
        },
        logins
      )
    )
    .toSorted(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id
    )
    .slice(-AUTOPILOT_REVISION_MAX_COMMENTS);
}

async function deleteRequestComment(
  octokit: AutopilotOctokit,
  ref: Pick<AutopilotPullRequestRef, "owner" | "repo">,
  commentId: number
) {
  await octokit.request(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
    {
      owner: ref.owner,
      repo: ref.repo,
      comment_id: commentId,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
}

/** What was asked from Notra and answered on the pull request, and whether it's still working. */
export async function loadFindingConversation(
  organizationId: string,
  findingId: string
): Promise<AutopilotRevisionConversation> {
  const { ref } = await loadFindingWithPullRequest(organizationId, findingId);
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: ref.owner,
    name: ref.repo,
  });
  const [head, comments] = await Promise.all([
    getPullRequestHead({
      octokit,
      owner: ref.owner,
      repo: ref.repo,
      pullNumber: ref.pullNumber,
    }),
    listComments(octokit, ref),
  ]);
  return {
    headSha: head.headSha,
    comments,
    working: isRevisionWorking(comments, Date.now()),
  };
}

/**
 * Posts the request on the pull request and returns the mention the GitHub
 * agent runs with, so the change lands on Autopilot's branch exactly as an
 * `@notra` comment there would. Only Autopilot's own open branches are edited.
 */
export async function prepareFindingRevision(params: {
  organizationId: string;
  findingId: string;
  userId: string;
  requester: string;
  instruction: string;
}): Promise<GitHubMentionContext> {
  const { finding, ref } = await loadFindingWithPullRequest(
    params.organizationId,
    params.findingId
  );
  if (finding.status !== "proposed") {
    throw new Error("Only an open pull request can be changed");
  }
  if (!finding.branch?.startsWith(`${AUTOPILOT_BRANCH_PREFIX}/`)) {
    throw new Error("Ask for changes on GitHub for this pull request");
  }
  const [octokit, installations] = await Promise.all([
    getRepositoryOctokit(params.organizationId, {
      owner: ref.owner,
      name: ref.repo,
    }),
    listGitHubAppInstallationsByOrganization(params.organizationId),
  ]);
  const installation = installations.find(
    (row) => row.accountLogin.toLowerCase() === ref.owner.toLowerCase()
  );
  if (!installation) {
    throw new Error(`The GitHub App is not installed on ${ref.owner}`);
  }
  const [head, repository, comments] = await Promise.all([
    getPullRequestHead({
      octokit,
      owner: ref.owner,
      repo: ref.repo,
      pullNumber: ref.pullNumber,
    }),
    octokit.request("GET /repos/{owner}/{repo}", {
      owner: ref.owner,
      repo: ref.repo,
      headers: GITHUB_API_VERSION_HEADERS,
    }),
    listComments(octokit, ref),
  ]);
  if (head.state !== "open") {
    throw new Error("The pull request is no longer open");
  }
  if (isRevisionWorking(comments, Date.now())) {
    throw new Error("Autopilot is still working on the last request");
  }
  const [integration, publication] = await Promise.all([
    findGitHubIntegrationForMention({
      organizationId: params.organizationId,
      githubRepositoryId: String(repository.data.id),
      owner: ref.owner,
      repo: ref.repo,
    }),
    findContentPublicationForPullRequest({
      organizationId: params.organizationId,
      owner: ref.owner,
      repo: ref.repo,
      pullRequestNumber: ref.pullNumber,
    }),
  ]);
  if (!integration) {
    throw new Error(
      `Connect ${ref.owner}/${ref.repo} under Integrations so Autopilot can edit its pull requests`
    );
  }
  const body = buildRevisionRequestBody(params.requester, params.instruction);
  const comment = await postGitHubIssueComment({
    octokit,
    owner: ref.owner,
    repo: ref.repo,
    issueNumber: ref.pullNumber,
    body,
  });
  // Two people can ask at once: the request posted first runs, the other is
  // taken back, so one branch never has two agents writing to it.
  const withdraw = () =>
    deleteRequestComment(octokit, ref, Number(comment.id)).catch(
      () => undefined
    );
  let first: AutopilotRevisionComment | undefined;
  try {
    // react-doctor-disable-next-line react-doctor/server-sequential-independent-await -- the list must include the comment just posted
    const after = await listComments(octokit, ref);
    first = openRevisionRequests(after, Date.now())[0];
  } catch (error) {
    // No run starts without this check, so the request must not stay up.
    await withdraw();
    throw error;
  }
  if (first && first.id !== Number(comment.id)) {
    await withdraw();
    throw new Error("Autopilot is still working on the last request");
  }
  // The App's own login: a made-up handle could notify a real GitHub user.
  const appHandle = getGitHubMentionAppHandles()[0] ?? "notra";
  return {
    deliveryId: `${AUTOPILOT_REVISION_DELIVERY_PREFIX}${String(comment.id)}`,
    installationId: installation.installationId,
    organizationId: params.organizationId,
    userId: params.userId,
    integrationId: integration.id,
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch: repository.data.default_branch,
    issueNumber: ref.pullNumber,
    comment: {
      id: Number(comment.id),
      body,
      htmlUrl: comment.htmlUrl,
      review: null,
      updatedAt: new Date().toISOString(),
    },
    sender: { id: 0, login: `${appHandle}[bot]`, type: "User" },
    pullRequest: {
      number: head.number,
      title: head.title,
      body: head.body,
      htmlUrl: head.htmlUrl,
      headRef: head.headRef,
      headSha: head.headSha,
      headRepoFullName: head.headRepoFullName,
      baseRef: head.baseRef,
      draft: head.draft,
      authorLogin: head.authorLogin,
    },
    destination: {
      mode: "same_pull_request",
      pullRequestNumber: head.number,
      headRef: head.headRef,
      headSha: head.headSha,
    },
    publication,
  };
}

/** Takes a request back off the pull request when its agent run never started. */
export async function withdrawFindingRevision(
  organizationId: string,
  mention: GitHubMentionContext
) {
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: mention.owner,
    name: mention.repo,
  });
  await deleteRequestComment(octokit, mention, mention.comment.id);
}
