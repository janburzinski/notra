import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import type {
  AutopilotApprovalGroup,
  AutopilotApprovals,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";
import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";

import { AUTOPILOT_BRANCH_PREFIX } from "@/constants/autopilot";
import {
  AUTOPILOT_APPROVAL_GROUP_BY_KIND,
  AUTOPILOT_HOLD_PAGE_SIZE,
  AUTOPILOT_HOLD_REASONS,
  AUTOPILOT_NEW_POST_KINDS,
  AUTOPILOT_PUBLISH_BATCH,
  AUTOPILOT_PUBLISH_RETRY_MS,
} from "@/constants/autopilot-publish";
import { mergeFinding, pullRequestRef } from "@/lib/autopilot/findings";
import { getRepositoryOctokit } from "@/lib/autopilot/github";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { autopilotBaseBranch } from "@/lib/autopilot/sites";
import {
  getContentPullRequestState,
  markContentPullRequestReady,
} from "@/lib/integrations/github/content-pull-request";
import { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type {
  AutopilotPullRequestEvent,
  AutopilotRunContext,
} from "@/types/autopilot";
import type { AutopilotHoldReason } from "@/types/autopilot-publish";
import type {
  AutopilotFindingRow,
  AutopilotLogger,
  AutopilotOctokit,
} from "@/types/autopilot-runtime";
import { parseCommitFingerprint } from "@/utils/autopilot-github";
import {
  autopilotApprovalGroup,
  autopilotHoldDecision,
  formatAutopilotPublishAt,
  hasFactCheckFlags,
  nextAutopilotPublishAt,
  pullRequestEventHoldReason,
  touchesPathsOutside,
} from "@/utils/autopilot-publish";
import { toErrorMessage } from "@/utils/error-message";

/** True once a person merged a finding of this approval group before. */
async function hasMergedFinding(
  organizationId: string,
  group: AutopilotApprovalGroup
) {
  const pageType = sql`jsonb_typeof(${autopilotFindings.evidence}->'updatePage')`;
  const kindsOf = (target: AutopilotApprovalGroup) =>
    Object.entries(AUTOPILOT_APPROVAL_GROUP_BY_KIND)
      .filter(([, value]) => value === target)
      .map(([kind]) => kind as AutopilotJobKind);
  const groupFilter = {
    posts: and(
      inArray(autopilotFindings.kind, AUTOPILOT_NEW_POST_KINDS),
      sql`${pageType} is distinct from 'object'`
    ),
    updates: or(
      inArray(autopilotFindings.kind, kindsOf("updates")),
      and(
        inArray(autopilotFindings.kind, AUTOPILOT_NEW_POST_KINDS),
        sql`${pageType} = 'object'`
      )
    ),
    fixes: inArray(autopilotFindings.kind, kindsOf("fixes")),
  } satisfies Record<AutopilotApprovalGroup, unknown>;
  const merged = await db.query.autopilotFindings.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.status, "merged"),
      groupFilter[group]
    ),
  });
  return Boolean(merged);
}

async function featureShipped(
  organizationId: string,
  finding: AutopilotFindingRow
) {
  const source = parseCommitFingerprint(finding.fingerprint);
  if (!source) {
    return true;
  }
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: source.owner,
    name: source.repo,
  });
  const { data: pull } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    { owner: source.owner, repo: source.repo, pull_number: source.pullNumber }
  );
  return Boolean(pull.merged_at);
}

async function holdReasonFor(params: {
  ctx: AutopilotRunContext;
  group: AutopilotApprovalGroup;
  finding: AutopilotFindingRow;
  body: string;
  paths: string[];
  contentFolders: string[];
}): Promise<AutopilotHoldReason | null> {
  const { ctx } = params;
  if (!(await hasMergedFinding(ctx.organizationId, params.group))) {
    return AUTOPILOT_HOLD_REASONS.firstPost;
  }
  if (
    !(await featureShipped(ctx.organizationId, params.finding).catch(
      () => false
    ))
  ) {
    return AUTOPILOT_HOLD_REASONS.unshipped;
  }
  if (hasFactCheckFlags(params.body)) {
    return AUTOPILOT_HOLD_REASONS.factCheck;
  }
  if (
    touchesPathsOutside(params.paths, [
      ctx.contentPath,
      ctx.integrationContentPath,
      ...params.contentFolders,
    ])
  ) {
    return AUTOPILOT_HOLD_REASONS.outsideContent;
  }
  return null;
}

export async function scheduleAutopilotPublish(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  octokit: AutopilotOctokit;
  finding: AutopilotFindingRow;
  updatesExistingPage?: boolean;
  pullRequestNumber: number;
  body: string;
  paths: string[];
  contentFolders?: string[];
}) {
  const { ctx, log } = params;
  const findingId = params.finding.id;
  const group = autopilotApprovalGroup(
    params.finding.kind,
    params.updatesExistingPage ?? false
  );
  if (!(group && ctx.approvals[group] === "auto" && ctx.repository)) {
    await db
      .update(autopilotFindings)
      .set({ publishAt: null })
      .where(
        and(
          eq(autopilotFindings.id, findingId),
          isNotNull(autopilotFindings.publishAt)
        )
      );
    return;
  }
  const reason = await holdReasonFor({
    ctx,
    group,
    finding: params.finding,
    body: params.body,
    paths: params.paths,
    contentFolders: params.contentFolders ?? [],
  });
  if (reason) {
    await db
      .update(autopilotFindings)
      .set({ publishAt: null, publishHoldReason: reason })
      .where(eq(autopilotFindings.id, findingId));
    await log.skip(`Waits for you: ${reason}`);
    return;
  }
  try {
    const state = await getContentPullRequestState(params.octokit, {
      owner: ctx.repository.owner,
      repo: ctx.repository.name,
      pullNumber: params.pullRequestNumber,
    });
    if (state.status !== "open") {
      return;
    }
    await markContentPullRequestReady(params.octokit, state);
  } catch (error) {
    await log.error("Could not mark the pull request ready for review", {
      error: toErrorMessage(error, String(error)),
    });
    return;
  }
  const publishAt = nextAutopilotPublishAt(new Date(), ctx.timezone);
  const scheduled = await db
    .update(autopilotFindings)
    .set({
      publishAt,
      publishHoldReason: null,
      evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{publishGroup}', to_jsonb(${group}::text))`,
    })
    .where(
      and(
        eq(autopilotFindings.organizationId, ctx.organizationId),
        eq(autopilotFindings.id, findingId),
        eq(autopilotFindings.status, "proposed"),
        eq(autopilotFindings.pullRequestNumber, params.pullRequestNumber)
      )
    )
    .returning({ id: autopilotFindings.id });
  if (scheduled.length > 0) {
    await log.action(
      `Publishes ${formatAutopilotPublishAt(publishAt, ctx.timezone)} unless someone steps in`,
      { publishAt: publishAt.toISOString() }
    );
  }
}

async function recordHoldCancel(
  finding: AutopilotFindingRow,
  reason: AutopilotHoldReason
) {
  const cancelled = await db
    .update(autopilotFindings)
    .set({ publishAt: null, publishHoldReason: reason })
    .where(
      and(
        eq(autopilotFindings.id, finding.id),
        eq(autopilotFindings.status, "proposed"),
        isNotNull(autopilotFindings.publishAt)
      )
    )
    .returning({ id: autopilotFindings.id });
  if (cancelled.length > 0 && finding.runId) {
    await createAutopilotLogger(
      { organizationId: finding.organizationId, runId: finding.runId },
      finding.kind
    ).skip(`Waits for you: ${reason}`, {
      url: finding.pullRequestUrl,
    });
  }
  return cancelled.length > 0;
}

async function inspectHold(
  finding: AutopilotFindingRow,
  now: Date,
  expectedBaseRef: string | null
) {
  const ref = pullRequestRef(finding);
  if (!ref) {
    return autopilotHoldDecision({
      expectedHeadSha: null,
      expectedBaseRef: null,
      pullRequest: {
        state: "closed",
        merged: false,
        draft: false,
        headSha: "",
        baseRef: "",
        mergeable: null,
        mergeableState: null,
      },
      reviews: [],
      humanComments: 0,
      truncated: false,
      checks: [],
      waitingSince: now,
      now,
    });
  }
  const repository = { owner: ref.owner, name: ref.repo };
  const octokit = await getRepositoryOctokit(
    finding.organizationId,
    repository,
    { checks: "read" }
  ).catch(() => getRepositoryOctokit(finding.organizationId, repository));
  const target = { owner: ref.owner, repo: ref.repo };
  const { data: pull } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    { ...target, pull_number: ref.pullNumber }
  );
  const [reviews, issueComments, reviewComments, checks] = await Promise.all([
    octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
      ...target,
      pull_number: ref.pullNumber,
      per_page: AUTOPILOT_HOLD_PAGE_SIZE,
    }),
    octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        ...target,
        issue_number: ref.pullNumber,
        per_page: AUTOPILOT_HOLD_PAGE_SIZE,
      }
    ),
    octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
      ...target,
      pull_number: ref.pullNumber,
      per_page: AUTOPILOT_HOLD_PAGE_SIZE,
    }),
    octokit
      .request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
        ...target,
        ref: pull.head.sha,
        per_page: AUTOPILOT_HOLD_PAGE_SIZE,
      })
      .then(({ data }) => data)
      .catch(() => null),
  ]);
  const truncated =
    [reviews.data, issueComments.data, reviewComments.data].some(
      (page) => page.length >= AUTOPILOT_HOLD_PAGE_SIZE
    ) || (checks ? checks.total_count > checks.check_runs.length : false);
  return autopilotHoldDecision({
    expectedHeadSha: finding.headSha,
    expectedBaseRef,
    pullRequest: {
      state: pull.state,
      merged: Boolean(pull.merged),
      draft: Boolean(pull.draft),
      headSha: pull.head.sha,
      baseRef: pull.base.ref,
      mergeable: pull.mergeable ?? null,
      mergeableState: pull.mergeable_state ?? null,
    },
    reviews: reviews.data.map((review) => ({
      state: review.state,
      bot: review.user?.type === "Bot",
    })),
    humanComments: [...issueComments.data, ...reviewComments.data].filter(
      (comment) => comment.user?.type !== "Bot"
    ).length,
    truncated,
    checks:
      checks?.check_runs.map((check) => ({
        status: check.status,
        conclusion: check.conclusion ?? null,
      })) ?? null,
    waitingSince: finding.openedAt ?? finding.createdAt,
    now,
  });
}

function heldApprovalGroup(finding: AutopilotFindingRow) {
  return (
    finding.evidence.publishGroup ??
    autopilotApprovalGroup(finding.kind, Boolean(finding.evidence.updatePage))
  );
}

async function isStillScheduled(findingId: string, claimedAt: Date) {
  const row = await db.query.autopilotFindings.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotFindings.id, findingId),
      eq(autopilotFindings.status, "proposed"),
      eq(autopilotFindings.publishAt, claimedAt)
    ),
  });
  return Boolean(row);
}

async function publishFinding(
  finding: AutopilotFindingRow,
  approvals: AutopilotApprovals,
  now: Date,
  claimedAt: Date,
  baseBranch: string | null
) {
  const group = heldApprovalGroup(finding);
  if (!(group && approvals[group] === "auto")) {
    await recordHoldCancel(finding, AUTOPILOT_HOLD_REASONS.switchedToAsk);
    return "cancelled";
  }
  let decision: Awaited<ReturnType<typeof inspectHold>>;
  try {
    decision = await inspectHold(finding, now, baseBranch);
  } catch (error) {
    logError("[Autopilot] Could not check a held pull request", error, {
      organizationId: finding.organizationId,
      findingId: finding.id,
    });
    return "waiting";
  }
  if (decision.action === "wait") {
    return "waiting";
  }
  if (decision.action === "cancel") {
    await recordHoldCancel(finding, decision.reason);
    return "cancelled";
  }
  try {
    await mergeFinding(
      finding.organizationId,
      finding.id,
      undefined,
      async () => {
        if (!(await isStillScheduled(finding.id, claimedAt))) {
          throw new Error("The scheduled publish was cancelled");
        }
      },
      true
    );
  } catch (error) {
    if (!(await isStillScheduled(finding.id, claimedAt))) {
      return "cancelled";
    }
    logError("[Autopilot] Scheduled publish failed", error, {
      organizationId: finding.organizationId,
      findingId: finding.id,
    });
    await recordHoldCancel(finding, AUTOPILOT_HOLD_REASONS.mergeFailed);
    return "cancelled";
  }
  if (finding.runId) {
    await createAutopilotLogger(
      { organizationId: finding.organizationId, runId: finding.runId },
      finding.kind
    ).action(`Published pull request #${finding.pullRequestNumber}`, {
      url: finding.pullRequestUrl,
    });
  }
  return "published";
}

export async function publishDueFindings(
  organizationId: string,
  approvals: AutopilotApprovals,
  now: Date = new Date(),
  target: {
    siteId: string | null;
    repositoryBranch: string | null;
  } | null = null
) {
  const due = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.status, "proposed"),
      lte(autopilotFindings.publishAt, now)
    ),
    orderBy: [asc(autopilotFindings.publishAt)],
    limit: AUTOPILOT_PUBLISH_BATCH,
  });
  const outcomes = { published: 0, waiting: 0, cancelled: 0 };
  const baseBranch =
    due.length > 0 && target
      ? await autopilotBaseBranch(organizationId, target)
      : null;
  for (const finding of due) {
    if (!finding.publishAt) {
      continue;
    }
    const claimedAt = new Date(now.getTime() + AUTOPILOT_PUBLISH_RETRY_MS);
    const claimed = await db
      .update(autopilotFindings)
      .set({ publishAt: claimedAt })
      .where(
        and(
          eq(autopilotFindings.id, finding.id),
          eq(autopilotFindings.status, "proposed"),
          eq(autopilotFindings.publishAt, finding.publishAt)
        )
      )
      .returning({ id: autopilotFindings.id });
    if (claimed.length === 0) {
      continue;
    }
    outcomes[
      await publishFinding(finding, approvals, now, claimedAt, baseBranch)
    ] += 1;
  }
  return outcomes;
}

export async function holdFinding(organizationId: string, findingId: string) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  if (!finding) {
    throw new Error("Finding not found");
  }
  await recordHoldCancel(finding, AUTOPILOT_HOLD_REASONS.held);
}

export async function cancelHoldsAfterSettingsChange(
  organizationId: string,
  settings: { enabled: boolean; approvals: AutopilotApprovals }
) {
  const held = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.status, "proposed"),
      isNotNull(autopilotFindings.publishAt)
    ),
  });
  for (const finding of held) {
    const group = heldApprovalGroup(finding);
    if (!settings.enabled) {
      await recordHoldCancel(finding, AUTOPILOT_HOLD_REASONS.autopilotOff);
    } else if (!(group && settings.approvals[group] === "auto")) {
      await recordHoldCancel(finding, AUTOPILOT_HOLD_REASONS.switchedToAsk);
    }
  }
}

export async function cancelHoldsForPullRequestWebhook(rawBody: string) {
  try {
    const parsed = autopilotPullRequestEventSchema.safeParse(
      JSON.parse(rawBody)
    );
    if (parsed.success) {
      await cancelHoldsForPullRequestEvent(parsed.data);
    }
  } catch (error) {
    logError("[Autopilot] Could not cancel holds from a webhook", error);
  }
}

export async function cancelHoldsForPullRequestEvent(
  event: AutopilotPullRequestEvent
) {
  if (!event.pull_request.head.ref.startsWith(`${AUTOPILOT_BRANCH_PREFIX}/`)) {
    return;
  }
  const reason = pullRequestEventHoldReason(
    event.action,
    event.sender?.type ?? null,
    event.changes?.base !== undefined
  );
  if (!reason) {
    return;
  }
  const held = await db.query.autopilotFindings.findMany({
    where: and(
      sql`lower(${autopilotFindings.repository}) = ${event.repository.full_name.toLowerCase()}`,
      eq(autopilotFindings.pullRequestNumber, event.pull_request.number),
      eq(autopilotFindings.status, "proposed"),
      isNotNull(autopilotFindings.publishAt)
    ),
  });
  for (const finding of held) {
    await recordHoldCancel(finding, reason);
  }
}
