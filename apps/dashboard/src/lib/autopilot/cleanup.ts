import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

import {
  AUTOPILOT_EXPIRED_COOLDOWN_MS,
  AUTOPILOT_PULL_REQUEST_EVENT_PAGES,
} from "@/constants/autopilot";
import {
  deleteAutopilotBranch,
  pullRequestRef,
} from "@/lib/autopilot/findings";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import type { AutopilotRunContext } from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotOctokit,
  AutopilotFindingRow as FindingRow,
  AutopilotPullRequestRef as PullRequestRef,
} from "@/types/autopilot-runtime";
import { toErrorMessage } from "@/utils/error-message";

const DAY_MS = 24 * 60 * 60 * 1000;

const isPerson = (user: { type?: string } | null | undefined) =>
  user?.type !== "Bot";

/**
 * Whether anyone besides bots worked on the pull request: marked it ready,
 * reviewed, commented or pushed. Commits without a GitHub author count as a
 * person, so an unknown author never gets a draft closed.
 */
async function wasTouched(octokit: AutopilotOctokit, ref: PullRequestRef) {
  const params = {
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
    per_page: 100,
  };
  const { data: pull } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    params
  );
  if (pull.state !== "open") {
    return { open: false, touched: true };
  }
  if (!pull.draft) {
    return { open: true, touched: true };
  }
  const [reviews, comments, reviewComments, commits] = await Promise.all([
    octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      params
    ),
    octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.pullNumber,
        per_page: 100,
      }
    ),
    octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
      params
    ),
    octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
      params
    ),
  ]);
  const touched =
    reviews.data.some((review) => isPerson(review.user)) ||
    comments.data.some((comment) => isPerson(comment.user)) ||
    reviewComments.data.some((comment) => isPerson(comment.user)) ||
    commits.data.some((commit) => isPerson(commit.author));
  return { open: true, touched };
}

/**
 * Whether the pull request was closed at some point, reading every page of
 * its events. Past the page limit it counts as closed, so a long history
 * never gets a reopened draft closed again.
 */
async function wasEverClosed(octokit: AutopilotOctokit, ref: PullRequestRef) {
  for (let page = 1; page <= AUTOPILOT_PULL_REQUEST_EVENT_PAGES; page += 1) {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/events",
      {
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.pullNumber,
        per_page: 100,
        page,
      }
    );
    if (data.some((event) => event.event === "closed")) {
      return true;
    }
    if (data.length < 100) {
      return false;
    }
  }
  return true;
}

/** Back to a live proposal, for drafts that are still or again open on GitHub. */
async function reviveExpired(findingId: string) {
  await db
    .update(autopilotFindings)
    .set({ status: "proposed", dismissedAt: null })
    .where(
      and(
        eq(autopilotFindings.id, findingId),
        eq(autopilotFindings.status, "expired")
      )
    );
}

/** Closes the draft on GitHub, says why, and removes its branch. */
async function closeDraft(params: {
  octokit: AutopilotOctokit;
  ref: PullRequestRef;
  finding: FindingRow;
  days: number;
  log: AutopilotLogger;
}) {
  const { octokit, ref, finding, days } = params;
  await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
    state: "closed",
  });
  await octokit
    .request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: ref.owner,
      repo: ref.repo,
      issue_number: ref.pullNumber,
      body: `Closed this draft because nobody worked on it for ${days} days. Reopen it if you still want it; Notra doesn't count this as a no.`,
    })
    .catch(() => undefined);
  await deleteAutopilotBranch(octokit, ref, finding.branch);
  await params.log.action(
    `Closed #${ref.pullNumber}: untouched for ${days} days`,
    { url: finding.pullRequestUrl, title: finding.title }
  );
}

/**
 * Expired drafts whose pull request is open on GitHub. Without a "closed"
 * event the close never landed (a run stopped between recording and closing),
 * so it is finished now, unless someone worked on it since. With one, someone
 * reopened it and wants it after all, so it counts as open again. A merge
 * after reopening is recorded as a merge.
 */
async function reconcileExpired(
  ctx: AutopilotRunContext,
  log: AutopilotLogger,
  days: number | null
) {
  const expired = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      eq(autopilotFindings.status, "expired"),
      gt(
        autopilotFindings.dismissedAt,
        new Date(Date.now() - AUTOPILOT_EXPIRED_COOLDOWN_MS)
      )
    ),
  });
  for (const finding of expired) {
    const ref = pullRequestRef(finding);
    if (!ref) {
      continue;
    }
    try {
      const octokit = await getRepositoryOctokit(ctx.organizationId, {
        owner: ref.owner,
        name: ref.repo,
      });
      const { data: pull } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner: ref.owner, repo: ref.repo, pull_number: ref.pullNumber }
      );
      if (pull.merged_at) {
        await db
          .update(autopilotFindings)
          .set({ status: "merged", mergedAt: new Date(pull.merged_at) })
          .where(
            and(
              eq(autopilotFindings.id, finding.id),
              eq(autopilotFindings.status, "expired")
            )
          );
        continue;
      }
      if (pull.state !== "open") {
        continue;
      }
      // Never closed means the run stopped before closing it. It is closed
      // now unless someone started working on it in the meantime.
      if (
        days &&
        !(await wasEverClosed(octokit, ref)) &&
        !(await wasTouched(octokit, ref)).touched
      ) {
        await closeDraft({ octokit, ref, finding, days, log });
        continue;
      }
      await reviveExpired(finding.id);
      await log.action(
        `#${ref.pullNumber} is open, so it counts as a draft again`,
        { url: finding.pullRequestUrl }
      );
    } catch (error) {
      await log.error(`Could not check #${ref.pullNumber} on GitHub`, {
        error: toErrorMessage(error, String(error)),
      });
    }
  }
}

/**
 * Closes Autopilot drafts nobody worked on for the configured number of days,
 * so they stop counting against the open pull request limit. The finding
 * becomes expired, not dismissed: it is no "no", nothing is remembered from
 * it, and the topic may come back after a cooldown.
 */
export async function closeStalePullRequests(ctx: AutopilotRunContext) {
  const days = ctx.stalePullRequestDays;
  const log = createAutopilotLogger(ctx, null);
  await reconcileExpired(ctx, log, days);
  if (!days) {
    return 0;
  }
  const cutoff = new Date(Date.now() - days * DAY_MS);
  // updatedAt moves when the pull request is opened, so it is the draft's age.
  const candidates = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      eq(autopilotFindings.status, "proposed"),
      lt(autopilotFindings.updatedAt, cutoff)
    ),
  });
  let closed = 0;
  for (const finding of candidates) {
    const ref = pullRequestRef(finding);
    if (!ref) {
      continue;
    }
    try {
      const octokit = await getRepositoryOctokit(ctx.organizationId, {
        owner: ref.owner,
        name: ref.repo,
      });
      const state = await wasTouched(octokit, ref);
      if (!state.open) {
        // Merged or closed on GitHub; the regular sync records which.
        continue;
      }
      if (state.touched) {
        await log.decision(
          `Kept #${ref.pullNumber} open past ${days} days: someone commented on it or pushed to it`,
          { url: finding.pullRequestUrl }
        );
        continue;
      }
      // Recorded first, so the "closed" webhook finds nothing to dismiss.
      const [expired] = await db
        .update(autopilotFindings)
        .set({ status: "expired", dismissedAt: new Date(), claimToken: null })
        .where(
          and(
            eq(autopilotFindings.id, finding.id),
            eq(autopilotFindings.status, "proposed")
          )
        )
        .returning({ id: autopilotFindings.id });
      if (!expired) {
        continue;
      }
      try {
        await closeDraft({ octokit, ref, finding, days, log });
      } catch (error) {
        // Still open on GitHub, so it has to stay a live proposal here too.
        await reviveExpired(finding.id);
        throw error;
      }
      closed += 1;
    } catch (error) {
      // GitHub access can lapse; the draft is looked at again tomorrow.
      await log.error(`Could not check #${ref.pullNumber} on GitHub`, {
        error: toErrorMessage(error, String(error)),
      });
    }
  }
  return closed;
}
