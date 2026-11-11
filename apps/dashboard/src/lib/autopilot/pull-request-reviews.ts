import { githubStatus } from "@notra/ai/utils/github-pr-commit";

import {
  AUTOPILOT_DREAM_COMMENT_MAX_CHARS,
  AUTOPILOT_DREAM_TRUSTED_COMMENT_ASSOCIATIONS,
  AUTOPILOT_DREAM_MAX_COMMENTS,
  AUTOPILOT_DREAM_MAX_EDIT_COMMITS,
  AUTOPILOT_DREAM_PATCH_MAX_CHARS,
} from "@/constants/autopilot-dream";
import { pullRequestRef } from "@/lib/autopilot/findings";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import type { AutopilotPullRequestReview } from "@/types/autopilot-dream";
import type { AutopilotFindingRow as FindingRow } from "@/types/autopilot-runtime";

const isPerson = (user: { type?: string } | null | undefined) =>
  user?.type !== "Bot";

const isTrustedCommenter = (row: {
  user: { type?: string } | null | undefined;
  author_association?: string;
}) =>
  isPerson(row.user) &&
  AUTOPILOT_DREAM_TRUSTED_COMMENT_ASSOCIATIONS.has(
    row.author_association ?? ""
  );

async function personComments(
  octokit: Awaited<ReturnType<typeof getRepositoryOctokit>>,
  ref: { owner: string; repo: string; pullNumber: number }
) {
  const params = {
    owner: ref.owner,
    repo: ref.repo,
    per_page: 50,
  };
  const [issue, review, reviews] = await Promise.all([
    octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        ...params,
        issue_number: ref.pullNumber,
      }
    ),
    octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
      ...params,
      pull_number: ref.pullNumber,
    }),
    octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
      ...params,
      pull_number: ref.pullNumber,
    }),
  ]);
  return [
    ...issue.data.filter(isTrustedCommenter).map((row) => row.body ?? ""),
    ...review.data
      .filter(isTrustedCommenter)
      .map((row) => `On ${row.path}: ${row.body}`),
    ...reviews.data.filter(isTrustedCommenter).map((row) => row.body ?? ""),
  ]
    .filter((body) => body.trim())
    .slice(0, AUTOPILOT_DREAM_MAX_COMMENTS)
    .map((body) => body.trim().slice(0, AUTOPILOT_DREAM_COMMENT_MAX_CHARS));
}

function renderPatch(
  files: readonly { filename: string; status: string; patch?: string }[]
) {
  let patch = "";
  for (const file of files) {
    const chunk = `--- ${file.filename} (${file.status})\n${file.patch ?? ""}\n`;
    if (patch.length + chunk.length > AUTOPILOT_DREAM_PATCH_MAX_CHARS) {
      return (
        patch + chunk.slice(0, AUTOPILOT_DREAM_PATCH_MAX_CHARS - patch.length)
      );
    }
    patch += chunk;
  }
  return patch;
}

const isPersonEdit = (commit: {
  author: { type?: string } | null;
  parents?: readonly unknown[];
}) => isPerson(commit.author) && (commit.parents?.length ?? 1) <= 1;

async function personEdits(
  octokit: Awaited<ReturnType<typeof getRepositoryOctokit>>,
  ref: { owner: string; repo: string; pullNumber: number },
  from: string,
  to: string,
  baseSha: string
) {
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/compare/{basehead}",
      { owner: ref.owner, repo: ref.repo, basehead: `${from}...${to}` }
    );
    const mergedBase = data.commits.some(
      (commit) => (commit.parents?.length ?? 1) > 1
    );
    const own = mergedBase
      ? new Set(
          (
            await octokit.request(
              "GET /repos/{owner}/{repo}/compare/{basehead}",
              {
                owner: ref.owner,
                repo: ref.repo,
                basehead: `${baseSha}...${to}`,
              }
            )
          ).data.commits.map((commit) => commit.sha)
        )
      : null;
    const edits = data.commits.filter(
      (commit) => isPersonEdit(commit) && (!own || own.has(commit.sha))
    );
    if (edits.length === 0) {
      return null;
    }
    const { data: draftFiles } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: ref.owner,
        repo: ref.repo,
        pull_number: ref.pullNumber,
        per_page: 100,
      }
    );
    const inDraft = new Set(draftFiles.map((file) => file.filename));
    const draftPatch = (
      files: readonly { filename: string; status: string; patch?: string }[]
    ) => {
      const touched = files.filter((file) => inDraft.has(file.filename));
      return touched.length > 0 ? renderPatch(touched) : null;
    };
    if (edits.length === data.commits.length) {
      return draftPatch(data.files ?? []);
    }
    const commits = await Promise.all(
      edits.slice(0, AUTOPILOT_DREAM_MAX_EDIT_COMMITS).map((commit) =>
        octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner: ref.owner,
          repo: ref.repo,
          ref: commit.sha,
        })
      )
    );
    return draftPatch(
      commits.flatMap(({ data: commit }) => commit.files ?? [])
    );
  } catch (error) {
    if (githubStatus(error) === 404) {
      return null;
    }
    throw error;
  }
}

export async function reviewClosedPullRequest(
  organizationId: string,
  finding: FindingRow
): Promise<AutopilotPullRequestReview | null> {
  const ref = pullRequestRef(finding);
  if (!(ref && finding.headSha && finding.repository)) {
    return null;
  }
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: ref.owner,
    name: ref.repo,
  });
  const { data: pull } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    { owner: ref.owner, repo: ref.repo, pull_number: ref.pullNumber }
  );
  const [patch, comments] = await Promise.all([
    pull.head.sha === finding.headSha
      ? Promise.resolve(null)
      : personEdits(
          octokit,
          ref,
          finding.headSha,
          pull.head.sha,
          pull.base.sha
        ),
    personComments(octokit, ref),
  ]);
  const closedAt =
    finding.status === "merged" ? finding.mergedAt : finding.dismissedAt;
  return {
    findingId: finding.id,
    repository: finding.repository,
    pullRequest: `${finding.repository}#${ref.pullNumber}`,
    number: ref.pullNumber,
    title: pull.title,
    outcome: finding.status === "merged" ? "merged" : "closed",
    closedAt: (closedAt ?? new Date()).toISOString(),
    edited: patch !== null,
    patch: patch ?? "",
    comments,
  };
}
