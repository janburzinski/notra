import {
  findGitHubIntegrationForMention,
  listOrganizationsForGitHubInstallation,
} from "@notra/ai/utils/github-mention-auth";
import { postGitHubIssueComment } from "@notra/ai/utils/github-pr-comments";
import { logInfo } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotSettings } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_FINDING_MAX_FAILURES,
  AUTOPILOT_IDEA_AUTO_WRITE_DAYS,
  AUTOPILOT_JEV_MIN_CONFIDENCE,
  AUTOPILOT_PR_AUTO_WRITE_CONFIDENCE,
  AUTOPILOT_PR_OFFER_CONFIDENCE,
} from "@/constants/autopilot";
import {
  assessPullRequestForPost,
  proposeCommitPost,
} from "@/lib/autopilot/blog";
import {
  dismissFinding,
  findFindingByFingerprint,
  rememberOfferComment,
} from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import {
  createAutopilotLogger,
  silentAutopilotLogger,
} from "@/lib/autopilot/log";
import {
  buildAutopilotRunContext,
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import {
  getContentPullRequestState,
  markContentPullRequestReady,
} from "@/lib/integrations/github/content-pull-request";
import { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type {
  AutopilotJobResult,
  AutopilotPullRequestEvent,
  AutopilotRunContext,
  MergedPullRequest,
} from "@/types/autopilot";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import { formatAutopilotPercent as percent } from "@/utils/autopilot-events";
import {
  commitFingerprint,
  describeAutopilotDraftLocation,
  autopilotPullRequestMoment,
  isPostCandidateTitle,
  toMergedPullRequest,
} from "@/utils/autopilot-github";
import { toErrorMessage } from "@/utils/error-message";

/** Workspaces that want Autopilot to look at pull requests in this repository. */
async function listEligibleOrganizations(params: {
  installationId: string;
  repositoryId: string;
  owner: string;
  repo: string;
}) {
  const organizations = await listOrganizationsForGitHubInstallation(
    params.installationId
  );
  const eligible: string[] = [];
  for (const { organizationId } of organizations) {
    const [available, settings, integration] = await Promise.all([
      isAutopilotEnabledForOrganization(organizationId),
      db.query.autopilotSettings.findFirst({
        columns: { enabled: true, jobs: true },
        where: eq(autopilotSettings.organizationId, organizationId),
      }),
      // "@notra write a post" only works where mentions are connected.
      findGitHubIntegrationForMention({
        organizationId,
        githubRepositoryId: params.repositoryId,
        owner: params.owner,
        repo: params.repo,
      }),
    ]);
    const jobs = { ...AUTOPILOT_DEFAULT_JOBS, ...settings?.jobs };
    if (available && settings?.enabled && jobs.commits && integration) {
      eligible.push(organizationId);
    }
  }
  return eligible;
}

/**
 * Autopilot on product pull requests. When a PR is ready for review, Jev
 * decides once whether the change is worth a post: 95%+ drafts it right away,
 * 85%+ asks in a comment, 60%+ waits silently on the dashboard. A PR merged
 * without that look gets it at merge. The draft follows the feature: closed
 * unmerged closes the draft, merged tells the draft it can ship.
 */
export async function handleAutopilotPullRequestEvent(rawBody: string) {
  const parsed = autopilotPullRequestEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return;
  }
  const event = parsed.data;
  const pr = event.pull_request;
  const moment = autopilotPullRequestMoment(event);
  if (!moment) {
    return;
  }
  const organizations = await listEligibleOrganizations({
    installationId: String(event.installation.id),
    repositoryId: String(event.repository.id),
    owner: event.repository.owner.login,
    repo: event.repository.name,
  });
  // One look per pull request even when several workspaces share the install.
  const organizationId = organizations[0];
  if (!organizationId) {
    return;
  }
  const pull = toMergedPullRequest(event.repository.full_name, {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    body: pr.body ?? null,
    author: pr.user?.login ?? null,
  });
  const existing = await findFindingByFingerprint(
    organizationId,
    commitFingerprint(pull)
  );
  if (moment === "closed") {
    if (
      existing &&
      ["proposed", "suggested", "open", "failed"].includes(existing.status)
    ) {
      // The feature is gone, so is its post.
      await dismissFinding(organizationId, existing.id).catch(() => undefined);
      logInfo("autopilot.pull_request_closed", {
        organizationId,
        pullRequest: `${pull.repository}#${pull.number}`,
        finding: existing.id,
      });
    }
    return;
  }
  if (
    existing &&
    !(
      existing.status === "failed" &&
      (existing.evidence.failures ?? 0) < AUTOPILOT_FINDING_MAX_FAILURES
    )
  ) {
    if (moment === "merged" && existing.status === "proposed") {
      await notifyDraftReady(organizationId, existing, pull);
    }
    // Either way one look per pull request: it already happened.
    return;
  }
  if (!isPostCandidateTitle(pr.title)) {
    return;
  }
  await assessAndAct({ organizationId, event, pull, moment });
}

async function assessAndAct(params: {
  organizationId: string;
  event: AutopilotPullRequestEvent;
  pull: MergedPullRequest;
  moment: "ready" | "merged";
}) {
  const { organizationId, event, pull, moment } = params;
  const preview = await buildAutopilotRunContext(organizationId, "");
  const verdict = await assessPullRequestForPost({
    ctx: preview,
    log: silentAutopilotLogger,
    pull,
    minConfidence: AUTOPILOT_JEV_MIN_CONFIDENCE,
  });
  // Most pull requests end here; they become a run only when they lead somewhere.
  logInfo("autopilot.pull_request_check", {
    organizationId,
    moment,
    pullRequest: `${pull.repository}#${pull.number}`,
    worth: verdict?.worth ?? null,
    confidence: verdict?.confidence ?? null,
    probabilities: verdict?.probabilities ?? null,
  });
  if (!verdict?.worth) {
    return;
  }

  const runId = await createItemAutopilotRun(organizationId, "github");
  const ctx = { ...preview, runId };
  const log = createAutopilotLogger(ctx, "commits");
  const result: AutopilotJobResult = { findingIds: [], insights: [] };
  let error: string | undefined;
  try {
    await log.decision(
      `${pull.repository}#${pull.number} ${moment === "ready" ? "is ready for review" : "merged"} and looks worth a post`,
      { title: pull.title, confidence: verdict.confidence },
      { probabilities: verdict.probabilities, pull }
    );
    await proposeAndComment({ ctx, log, result, event, pull, verdict });
  } catch (failure) {
    error = toErrorMessage(failure, String(failure));
  } finally {
    await finishAutopilotRun({
      organizationId,
      runId,
      results: [result],
      slackMessageTs: null,
      scheduled: false,
      error,
    });
  }
}

async function proposeAndComment(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  result: AutopilotJobResult;
  event: AutopilotPullRequestEvent;
  pull: MergedPullRequest;
  verdict: { confidence: number };
}) {
  const { ctx, log, result, event, pull, verdict } = params;
  const canAutoWrite =
    verdict.confidence >= AUTOPILOT_PR_AUTO_WRITE_CONFIDENCE &&
    Boolean(ctx.repository);
  // The common writer claims the finding before reserving claim-scoped credits.
  // A competing event that loses the claim must never hold or release its credits.
  const outcome = await proposeCommitPost({
    ctx,
    log,
    result,
    pull,
    confidence: verdict.confidence,
    decision: {
      considered: [],
      threshold: AUTOPILOT_PR_AUTO_WRITE_CONFIDENCE,
      filteredOut: 0,
    },
    suggestOnly: !canAutoWrite,
  });
  let comment: Awaited<ReturnType<typeof commentOnPullRequest>> = null;
  if (outcome.status === "proposed") {
    // A public pull request must not reveal the private website repository.
    const where = describeAutopilotDraftLocation(
      outcome.url,
      event.repository.private === true
    );
    comment = await commentOnPullRequest({
      ctx,
      log,
      event,
      body: `**I drafted a post about this change** (${percent(verdict.confidence)} sure it's worth telling your users)${where}\n\nNothing is published until you merge the draft. If this pull request is closed without merging, I close the draft too.`,
    });
  } else if (
    outcome.status === "suggested" &&
    verdict.confidence >= AUTOPILOT_PR_OFFER_CONFIDENCE
  ) {
    comment = await commentOnPullRequest({
      ctx,
      log,
      event,
      body: `**Should I write a post about this?** It looks like something your users would want to hear about (${percent(verdict.confidence)} sure). Reply \`@notra write a post\` and I'll draft it now, or reply \`@notra no\` (or react with 👎) and I'll skip it. Otherwise I draft it in ${AUTOPILOT_IDEA_AUTO_WRITE_DAYS} days.`,
    });
  }
  if (comment && "findingId" in outcome && outcome.findingId) {
    await rememberOfferComment(outcome.findingId, {
      repository: event.repository.full_name,
      id: comment.id,
    });
  }
}

/** The feature shipped: take the waiting draft out of draft and say so. */
async function notifyDraftReady(
  organizationId: string,
  finding: NonNullable<Awaited<ReturnType<typeof findFindingByFingerprint>>>,
  pull: MergedPullRequest
) {
  const [owner, repo] = finding.repository?.split("/") ?? [];
  if (!(owner && repo && finding.pullRequestNumber)) {
    return;
  }
  try {
    const octokit = await getRepositoryOctokit(organizationId, {
      owner,
      name: repo,
    });
    const state = await getContentPullRequestState(octokit, {
      owner,
      repo,
      pullNumber: finding.pullRequestNumber,
    });
    if (state.status !== "open") {
      return;
    }
    await markContentPullRequestReady(octokit, state);
    await postGitHubIssueComment({
      octokit,
      owner,
      repo,
      issueNumber: finding.pullRequestNumber,
      body: `${pull.url} was merged, so I marked this post ready for review. Merge it to publish.`,
    });
  } catch {
    // A missed nudge is harmless; the draft is still on the dashboard.
  }
}

async function commentOnPullRequest(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  event: AutopilotPullRequestEvent;
  body: string;
}) {
  const { ctx, log, event } = params;
  try {
    const octokit = await getRepositoryOctokit(ctx.organizationId, {
      owner: event.repository.owner.login,
      name: event.repository.name,
    });
    const comment = await postGitHubIssueComment({
      octokit,
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issueNumber: event.pull_request.number,
      body: params.body,
    });
    await log.action("Commented on the pull request", {
      url: comment.htmlUrl,
    });
    return comment;
  } catch (error) {
    await log.error("Could not comment on the pull request", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
