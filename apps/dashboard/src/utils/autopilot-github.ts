import { GITHUB_MENTION_TRUSTED_AUTHOR_ASSOCIATIONS } from "@notra/ai/constants/github-mention";

import { AUTOPILOT_COMMITS_SKIP_TITLE } from "@/constants/autopilot";
import type {
  MergedPullRequest,
  AutopilotPullRequestEvent,
} from "@/types/autopilot";
import type {
  AutopilotPullRequestAuthor,
  AutopilotPullRequestSummary,
  AutopilotPullRequestMoment,
} from "@/types/autopilot-runtime";

export function commitFingerprint(
  pull: Pick<MergedPullRequest, "repository" | "number">
) {
  return `commits:${pull.repository}#${pull.number}`;
}

export function describePullRequest(pull: MergedPullRequest) {
  return `${pull.repository}#${pull.number} ${pull.title}: ${pull.body}`;
}

export function pullRequestLabel(pull: MergedPullRequest) {
  return `${pull.repository}#${pull.number} ${pull.title}`;
}

/** Excludes bot authors and Autopilot's own branches, not untrusted humans. */
export function isHumanPullRequest(pull: AutopilotPullRequestAuthor) {
  return !pull.headRef.startsWith("notra/") && pull.authorType !== "Bot";
}

export function isPostCandidateTitle(title: string) {
  return !AUTOPILOT_COMMITS_SKIP_TITLE.test(title);
}

/** Unknown or public source visibility must not reveal a private destination. */
export function describeAutopilotDraftLocation(
  url: string,
  sourceIsPrivate: boolean
) {
  return sourceIsPrivate
    ? `: ${url}`
    : ". You can review it in Notra Autopilot.";
}

/** Shared cheap admission for the webhook enqueue and the durable worker. */
export function autopilotPullRequestMoment(
  event: AutopilotPullRequestEvent
): AutopilotPullRequestMoment | null {
  const pr = event.pull_request;
  if (
    !GITHUB_MENTION_TRUSTED_AUTHOR_ASSOCIATIONS.some(
      (association) => association === pr.author_association
    ) ||
    !isHumanPullRequest({
      headRef: pr.head.ref,
      authorType: pr.user?.type ?? null,
    })
  ) {
    return null;
  }
  if (
    event.action === "ready_for_review" ||
    (event.action === "opened" && !pr.draft)
  ) {
    return "ready";
  }
  if (event.action === "closed") {
    return pr.merged ? "merged" : "closed";
  }
  return null;
}

export function toMergedPullRequest(
  repository: string,
  pull: AutopilotPullRequestSummary
): MergedPullRequest {
  return {
    repository,
    number: pull.number,
    title: pull.title,
    url: pull.url,
    body: (pull.body ?? "").replace(/\s+/g, " ").slice(0, 600),
  };
}
