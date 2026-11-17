import { requestAutopilotReviewers } from "@/lib/autopilot/github";
import type {
  AutopilotRepository,
  AutopilotRunContext,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotOctokit,
} from "@/types/autopilot-runtime";
import { autopilotReviewers } from "@/utils/autopilot-github";
import { splitAutopilotReviewers } from "@/utils/autopilot-reviewers";
import { toErrorMessage } from "@/utils/error-message";

interface ReviewRequest {
  log: AutopilotLogger;
  octokit: AutopilotOctokit;
  repository: AutopilotRepository;
  pullNumber: number;
}

type Reviewer = { user: string } | { team: string };

/**
 * Asks everyone at once. GitHub refuses the whole request when one name can't
 * review (a typo, someone without access), so a refusal is retried one by one
 * and only the names GitHub refused are left out. Returns who was asked.
 */
async function request(
  params: ReviewRequest,
  reviewers: Reviewer[],
  failure: string
) {
  const { log, repository } = params;
  const name = (reviewer: Reviewer) =>
    "user" in reviewer
      ? `@${reviewer.user}`
      : `@${repository.owner}/${reviewer.team}`;
  const send = (batch: Reviewer[]) =>
    requestAutopilotReviewers(
      params.octokit,
      repository,
      params.pullNumber,
      batch.flatMap((reviewer) => ("user" in reviewer ? [reviewer.user] : [])),
      batch.flatMap((reviewer) => ("team" in reviewer ? [reviewer.team] : []))
    );
  const asked: Reviewer[] = [];
  const refused: { reviewer: string; error: string }[] = [];
  const attempt = async (batch: Reviewer[]) => {
    try {
      await send(batch);
      asked.push(...batch);
      return null;
    } catch (error) {
      return toErrorMessage(error, String(error));
    }
  };
  const error = await attempt(reviewers);
  const [only] = reviewers;
  if (error && only && reviewers.length === 1) {
    refused.push({ reviewer: name(only), error });
  } else if (error) {
    for (const reviewer of reviewers) {
      const single = await attempt([reviewer]);
      if (single) {
        refused.push({ reviewer: name(reviewer), error: single });
      }
    }
  }
  if (asked.length > 0) {
    const named = asked.map(name);
    await log.action(`Requested review from ${named.join(", ")}`, {
      reviewers: named,
    });
  }
  if (refused.length > 0) {
    await log.skip(failure, {
      reviewers: refused.map((entry) => entry.reviewer),
      error: refused.map((entry) => entry.error).join("; "),
    });
  }
  return new Set(
    asked.flatMap((reviewer) => ("user" in reviewer ? [reviewer.user] : []))
  );
}

/**
 * Asks for review on a draft Autopilot just opened: first the reviewers the
 * workspace named, then the authors of the pull requests it is about. The
 * authors are often not collaborators on the website repository, so they get
 * their own request. A refusal never fails the draft.
 */
export async function requestDraftReviewers(
  params: ReviewRequest & {
    ctx: AutopilotRunContext;
    sourcePullRequests?: { author?: string | null }[];
  }
) {
  const { users, teams, otherTeams } = splitAutopilotReviewers(
    params.ctx.reviewers,
    params.repository.owner
  );
  if (otherTeams.length > 0) {
    await params.log.skip(
      `Only teams of ${params.repository.owner} can review this repository`,
      { reviewers: otherTeams }
    );
  }
  const workspace: Reviewer[] = [
    ...users.map((user) => ({ user })),
    ...teams.map((team) => ({ team })),
  ];
  const asked =
    workspace.length > 0
      ? await request(
          params,
          workspace,
          "Could not request review from some of the workspace's reviewers"
        )
      : new Set<string>();
  const authors = autopilotReviewers(params.sourcePullRequests).filter(
    (login) => !asked.has(login.toLowerCase())
  );
  if (authors.length > 0) {
    await request(
      params,
      authors.map((user) => ({ user })),
      "Could not request review from the source authors"
    );
  }
}
