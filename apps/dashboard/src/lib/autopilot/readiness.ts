import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { createGitHubMentionUsageCollector } from "@notra/ai/billing/github-mention-billing";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { db } from "@notra/db/drizzle";
import { geoAgentReadinessReports } from "@notra/db/schema";
import type { AgentReadinessIssue } from "@notra/db/types/agent-readiness";
import {
  loadAgentReadiness,
  startAgentReadinessScan,
} from "@notra/geo-core/geo/agent-readiness";
import { requireGeoProject } from "@notra/geo-core/geo/projects";
import { buildAgentReadinessAllFixesPrompt } from "@notra/geo-core/utils/agent-readiness";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_FIX_MAX_FILES,
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
  AUTOPILOT_READINESS_AGENT_INPUT_TOKEN_BUDGET,
  AUTOPILOT_READINESS_AGENT_MAX_STEPS,
  AUTOPILOT_READINESS_MAX_AGE_MS,
  AUTOPILOT_READINESS_OFF_REPO_ISSUES,
  AUTOPILOT_READINESS_SCAN_POLL_MS,
  AUTOPILOT_READINESS_SCAN_WAIT_MS,
  AUTOPILOT_TREE_SUMMARY_MAX_LINES,
} from "@/constants/autopilot";
import {
  READINESS_AGENT_FINAL_NOTE,
  READINESS_AGENT_INSTRUCTIONS,
  READINESS_AGENT_WRAP_UP_NOTE,
} from "@/constants/autopilot-readiness";
import {
  claimFinding,
  countOpenPullRequests,
  hasOpenProposal,
  listDismissedReadinessIssueIds,
  markFindingFailed,
  markFindingProposed,
  markFindingWithoutChange,
  reserveDraftSlot,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  closeAutopilotPullRequest,
  getRepositoryOctokit,
  openAutopilotPullRequest,
} from "@/lib/autopilot/github";
import {
  assertAutopilotFindingLease,
  withAutopilotFindingLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { runRepositoryAgent } from "@/lib/autopilot/repository-agent";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { readinessAgentOutputSchema } from "@/schemas/autopilot";
import type {
  AutopilotRepository,
  AutopilotRunContext,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotReadinessCheck,
  AutopilotReadinessReport,
  AutopilotStagedFile,
  FindingClaim,
  ReadinessAgentOutput,
} from "@/types/autopilot-runtime";
import { autopilotDraftBranchSlug } from "@/utils/autopilot-branches";
import { summarizeRepositoryTree } from "@/utils/autopilot-paths";

/** False when the scan was still running at the deadline. */
async function waitForReport(reportId: string) {
  const deadline = Date.now() + AUTOPILOT_READINESS_SCAN_WAIT_MS;
  while (Date.now() < deadline) {
    const row = await db.query.geoAgentReadinessReports.findFirst({
      columns: { status: true },
      where: eq(geoAgentReadinessReports.id, reportId),
    });
    if (row?.status !== "running") {
      return true;
    }
    await sleep(AUTOPILOT_READINESS_SCAN_POLL_MS);
  }
  return false;
}

/** Returns the latest completed report, refreshing it first when it is stale. */
async function loadFreshReadinessReport(
  ctx: AutopilotRunContext,
  log?: AutopilotLogger
) {
  const load = Effect.gen(function* () {
    const scope = yield* requireGeoProject({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId ?? undefined,
    });
    const current = yield* loadAgentReadiness(scope);
    const scannedAt = current.report?.scannedAt
      ? new Date(current.report.scannedAt).getTime()
      : 0;
    const stale = Date.now() - scannedAt > AUTOPILOT_READINESS_MAX_AGE_MS;
    if (!stale) {
      return { current, scope, startedReportId: null };
    }
    const started = yield* startAgentReadinessScan(scope);
    return { current, scope, startedReportId: started.reportId };
  }).pipe(Effect.provide(geoCoreDashboardLayer));

  const { current, scope, startedReportId } = await Effect.runPromise(load);
  if (!startedReportId) {
    await log?.info("Used today's readiness scan", {
      url: current.targetUrl,
      scannedAt: current.report?.scannedAt
        ? new Date(current.report.scannedAt).toISOString()
        : null,
    });
    return current;
  }
  const startedAt = Date.now();
  const finished = await waitForReport(startedReportId);
  if (finished) {
    await log?.action(`Rescanned ${current.targetUrl}`, {
      durationMs: Date.now() - startedAt,
    });
  } else {
    await log?.info(
      `The rescan of ${current.targetUrl} didn't finish in ${Math.round(AUTOPILOT_READINESS_SCAN_WAIT_MS / 60_000)} minutes, so the last scan is used`,
      {
        scannedAt: current.report?.scannedAt
          ? new Date(current.report.scannedAt).toISOString()
          : null,
      }
    );
  }
  return Effect.runPromise(
    loadAgentReadiness(scope).pipe(Effect.provide(geoCoreDashboardLayer))
  );
}

/** Used when the agent staged files but its final answer is missing or invalid. */
function fallbackReadinessOutput(
  files: AutopilotStagedFile[]
): ReadinessAgentOutput {
  return {
    framework: "unknown",
    pullRequestTitle: "Improve agent readiness",
    pullRequestBody: files
      .map((file) => `- \`${file.path}\`: ${file.reason}`)
      .join("\n"),
  };
}

/** Explores the repository with read-only tools and stages complete files; every call is logged. */
function runReadinessAgent(params: {
  ctx: AutopilotRunContext;
  repository: AutopilotRepository;
  targetUrl: string;
  issues: AgentReadinessIssue[];
  log: AutopilotLogger;
  onUsage: (usage: AgentTokenUsage) => void;
}) {
  const { ctx, repository } = params;
  const issueIds = params.issues.map((issue) => issue.id);
  return runRepositoryAgent({
    ctx,
    repository,
    log: params.log,
    onUsage: params.onUsage,
    tag: "readiness-agent",
    instructions: READINESS_AGENT_INSTRUCTIONS,
    wrapUpNote: READINESS_AGENT_WRAP_UP_NOTE,
    finalNote: READINESS_AGENT_FINAL_NOTE,
    issueIds,
    issueName: (issueId) =>
      params.issues.find((issue) => issue.id === issueId)?.name ?? issueId,
    outputSchema: readinessAgentOutputSchema,
    fallbackOutput: fallbackReadinessOutput,
    maxFiles: AUTOPILOT_FIX_MAX_FILES,
    maxSteps: AUTOPILOT_READINESS_AGENT_MAX_STEPS,
    inputTokenBudget: AUTOPILOT_READINESS_AGENT_INPUT_TOKEN_BUDGET,
    prompt: (paths) =>
      [
        `Brand: ${ctx.brand?.name ?? "unknown"}. ${ctx.brand?.description ?? ""}`,
        `Website: ${params.targetUrl}`,
        `Repository: ${repository.owner}/${repository.name} (branch ${repository.branch}, ${paths.length} files)`,
        "",
        buildAgentReadinessAllFixesPrompt(params.targetUrl, params.issues),
        "",
        `Use these exact issue ids in writeFile and skipIssue: ${issueIds.join(", ")}`,
        "",
        "## Repository layout",
        summarizeRepositoryTree(paths, AUTOPILOT_TREE_SUMMARY_MAX_LINES),
      ].join("\n"),
  });
}

export async function checkReadiness(
  ctx: AutopilotRunContext
): Promise<AutopilotReadinessCheck> {
  const log = createAutopilotLogger(ctx, "readiness");
  const skip = async (reason: string) => {
    await log.skip(reason);
    return { ready: false as const, reason };
  };
  if (!ctx.repository) {
    return skip("No website repository connected");
  }
  if (!ctx.jobs.readiness) {
    return skip("Turned off in settings");
  }
  // PRs merged or closed on GitHub since the last run free up the budget.
  await syncFindingPullRequests(ctx.organizationId);
  const open = await countOpenPullRequests(ctx.organizationId);
  if (open >= ctx.maxOpenPullRequests) {
    return skip(
      `${open} of ${ctx.maxOpenPullRequests} pull requests are still open`
    );
  }
  // Checked before rescanning so an open PR doesn't cost a scan every day.
  if (await hasOpenProposal(ctx.organizationId, ["readiness"])) {
    return skip("A readiness pull request is still waiting for review");
  }
  const readiness = await loadFreshReadinessReport(ctx, log);
  const report = readiness.report;
  if (!report || report.score === null) {
    return skip("No completed readiness scan yet");
  }
  // Triage without tokens: bonus checks never block, API and product checks
  // can't be fixed from the website repo, and dismissed fixes stay dismissed.
  const dismissed = await listDismissedReadinessIssueIds(ctx.organizationId);
  const blocking = report.issues.filter((issue) => issue.tier !== "bonus");
  const offRepo = blocking.filter((issue) =>
    AUTOPILOT_READINESS_OFF_REPO_ISSUES.includes(issue.id)
  );
  const issues = blocking.filter(
    (issue) =>
      !(
        AUTOPILOT_READINESS_OFF_REPO_ISSUES.includes(issue.id) ||
        dismissed.has(issue.id)
      )
  );
  await log.decision(
    `Score ${Math.round(report.score)}: ${issues.length} of ${blocking.length} issues can be fixed in the repository`,
    {
      fixable: issues.map((issue) => issue.name),
      needsProductWork: offRepo.map((issue) => issue.name),
      previouslyDismissed: blocking
        .filter((issue) => dismissed.has(issue.id))
        .map((issue) => issue.name),
    },
    { reportUrl: report.reportUrl, score: report.score, issues: report.issues }
  );
  if (issues.length === 0) {
    return { ready: false, reason: "Nothing to fix in the repository" };
  }
  return {
    ready: true,
    targetUrl: readiness.targetUrl,
    report: { ...report, score: report.score },
    issues,
  };
}

export async function claimReadinessFix(params: {
  ctx: AutopilotRunContext;
  check: Extract<AutopilotReadinessCheck, { ready: true }>;
  claimToken: string;
}): Promise<{ claim: FindingClaim } | { reason: string }> {
  const { ctx, check } = params;
  const log = createAutopilotLogger(ctx, "readiness");
  const issueIds = check.issues.map((issue) => issue.id).sort();
  const claim = await claimFinding(
    ctx.organizationId,
    ctx.runId,
    {
      kind: "readiness",
      // Keyed by the issue set, not the report: daily rescans keep the same
      // fingerprint, so a dismissed fix stays dismissed until the issues change.
      fingerprint: `readiness:${createHash("sha256").update(issueIds.join(",")).digest("hex").slice(0, 16)}`,
      title: `Agent readiness ${Math.round(check.report.score)}/100: ${check.issues.length} fixable issues`,
      summary: check.issues
        .slice(0, 4)
        .map((issue) => issue.name)
        .join(", "),
      evidence: {
        sourceUrl: check.report.reportUrl ?? check.targetUrl,
        score: check.report.score,
        issueIds,
      },
    },
    params.claimToken
  );
  if (!claim) {
    const reason =
      "These issues are already being fixed, proposed, merged or dismissed";
    await log.skip(reason);
    return { reason };
  }
  const slot = await reserveDraftSlot(claim, ctx.maxOpenPullRequests);
  if (slot === "lost") {
    return { reason: "Someone else took over this fix" };
  }
  if (slot === "full") {
    const reason = "The workspace's draft pull request limit is already in use";
    await markFindingFailed(claim, reason, { count: false });
    await log.skip(reason);
    return { reason };
  }
  return { claim };
}

export async function writeReadinessFix(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: Extract<AutopilotReadinessCheck, { ready: true }>;
}) {
  const { ctx, claim, check } = params;
  const repository = ctx.repository;
  if (!repository) {
    throw new Error("No website repository connected");
  }
  const log = createAutopilotLogger(ctx, "readiness");
  const usage = createGitHubMentionUsageCollector();
  const { baseSha, output, files, skipped } = await withAutopilotFindingLease(
    claim,
    () =>
      runReadinessAgent({
        ctx,
        repository,
        targetUrl: check.targetUrl,
        issues: check.issues,
        log,
        onUsage: (next) => usage.add(next),
      })
  );
  if (files.length === 0) {
    const reason =
      skipped.map((skip) => `${skip.issueId}: ${skip.reason}`).join("; ") ||
      "No safe repository change found";
    // Not a failure: retrying the same issues tomorrow would pay for the same answer.
    await markFindingWithoutChange(claim, reason);
    await log.skip("No pull request: nothing in the repository to change", {
      reason,
    });
  }
  return { baseSha, output, files, skipped, usage: usage.get() };
}

export async function openReadinessPullRequest(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: Extract<AutopilotReadinessCheck, { ready: true }>;
  fix: {
    baseSha: string;
    output: ReadinessAgentOutput;
    files: AutopilotStagedFile[];
  };
}) {
  const { ctx, claim, check, fix } = params;
  const repository = ctx.repository;
  if (!repository) {
    throw new Error("No website repository connected");
  }
  const log = createAutopilotLogger(ctx, "readiness");
  const octokit = await getRepositoryOctokit(ctx.organizationId, repository);
  const fixed = new Set(fix.files.flatMap((file) => file.issueIds));
  const fixedIds = [...fixed];
  const fixedNames = check.issues
    .filter((issue) => fixed.has(issue.id))
    .map((issue) => issue.name);
  const body = [
    fix.output.pullRequestBody,
    "",
    `Scan: ${check.targetUrl} · Readiness: ${Math.round(check.report.score)}/100 · Framework: ${fix.output.framework}.`,
  ].join("\n");
  await assertAutopilotFindingLease(claim);
  const pullRequest = await openAutopilotPullRequest({
    octokit,
    repository,
    slug: autopilotDraftBranchSlug("readiness", claim),
    baseSha: fix.baseSha,
    title: fix.output.pullRequestTitle,
    body,
    files: fix.files.map((file) => ({
      path: file.path,
      contents: file.content,
    })),
  });
  const recorded = await markFindingProposed(
    claim,
    {
      repository: `${repository.owner}/${repository.name}`,
      ...pullRequest,
    },
    {
      title: fix.output.pullRequestTitle,
      summary:
        fixedNames.length > 0
          ? `Fixes ${fixedNames.join(", ")}`
          : `Changes ${fix.files.map((file) => file.path).join(", ")}`,
      // Only what the pull request touches: dismissing it must not mute issues it left alone.
      evidence: {
        sourceUrl: check.report.reportUrl ?? check.targetUrl,
        score: check.report.score,
        issueIds: fixedIds,
      },
    }
  );
  if (!recorded) {
    await closeAutopilotPullRequest(octokit, repository, pullRequest);
    await log.skip("Dismissed while fixing, so the pull request was closed");
    return { opened: false as const };
  }
  await log.action(`Opened pull request #${pullRequest.number}`, {
    event: AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
    url: pullRequest.url,
    files: fix.files.map((file) => file.path),
  });
  return { opened: true as const, url: pullRequest.url };
}
