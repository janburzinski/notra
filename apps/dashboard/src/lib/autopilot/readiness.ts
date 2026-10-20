import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { AGENT_DEFAULT_MODEL } from "@notra/ai/constants/models";
import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { db } from "@notra/db/drizzle";
import { geoAgentReadinessReports } from "@notra/db/schema";
import type { AgentReadinessIssue } from "@notra/db/types/agent-readiness";
import {
  loadAgentReadiness,
  startAgentReadinessScan,
} from "@notra/geo-core/geo/agent-readiness";
import { requireGeoProject } from "@notra/geo-core/geo/projects";
import { buildAgentReadinessAllFixesPrompt } from "@notra/geo-core/utils/agent-readiness";
import { isStepCount, Output, ToolLoopAgent, tool } from "ai";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import * as z from "zod";

import {
  AUTOPILOT_CONTEXT_FILE_MAX_CHARS,
  AUTOPILOT_FINDING_MAX_FAILURES,
  AUTOPILOT_FIX_MAX_FILES,
  AUTOPILOT_PROTECTED_PATH_PATTERNS,
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
  AUTOPILOT_READINESS_AGENT_MAX_STEPS,
  AUTOPILOT_READINESS_MAX_AGE_MS,
  AUTOPILOT_READINESS_OFF_REPO_ISSUES,
  AUTOPILOT_READINESS_SCAN_POLL_MS,
  AUTOPILOT_READINESS_SCAN_WAIT_MS,
  AUTOPILOT_TREE_MAX_PATHS,
  AUTOPILOT_TREE_SUMMARY_MAX_LINES,
} from "@/constants/autopilot";
import { READINESS_AGENT_INSTRUCTIONS } from "@/constants/autopilot-readiness";
import { withAutopilotDraftBilling } from "@/lib/autopilot/billing";
import {
  claimFinding,
  hasOpenProposal,
  listDismissedReadinessIssueIds,
  markFindingFailed,
  markFindingProposed,
  markFindingWithoutChange,
  reserveDraftSlot,
} from "@/lib/autopilot/findings";
import {
  closeAutopilotPullRequest,
  getBaseBranchSha,
  getRepositoryOctokit,
  listRepositoryPaths,
  openAutopilotPullRequest,
  readRepositoryFile,
  repositoryPathExists,
} from "@/lib/autopilot/github";
import {
  assertAutopilotFindingLease,
  withAutopilotFindingLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { readinessAgentOutputSchema } from "@/schemas/autopilot";
import type {
  AutopilotJobResult,
  AutopilotRepository,
  AutopilotRunContext,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotReadinessReport,
  AutopilotStagedFile,
  FindingClaim,
} from "@/types/autopilot-runtime";
import { autopilotDraftBranchSlug } from "@/utils/autopilot-branches";
import {
  isSafeRepositoryPath,
  summarizeRepositoryTree,
} from "@/utils/autopilot-paths";
import { toErrorMessage } from "@/utils/error-message";

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

function isProtectedPath(path: string) {
  return AUTOPILOT_PROTECTED_PATH_PATTERNS.some((pattern) =>
    pattern.test(path)
  );
}

/** Explores the repository with read-only tools and stages complete files; every call is logged. */
async function runReadinessAgent(params: {
  ctx: AutopilotRunContext;
  repository: AutopilotRepository;
  targetUrl: string;
  issues: AgentReadinessIssue[];
  log: AutopilotLogger;
  onUsage: (usage: AgentTokenUsage) => void;
}) {
  const { ctx, repository, log } = params;
  const octokit = await getRepositoryOctokit(ctx.organizationId, repository);
  const baseSha = await getBaseBranchSha(octokit, repository);
  const paths = await listRepositoryPaths(octokit, repository, baseSha);
  const existingPaths = new Set(paths);
  const issueIds = new Set(params.issues.map((issue) => issue.id));
  // Existing files may only be replaced when the agent read them in full.
  const fullyRead = new Set<string>();
  const staged = new Map<string, AutopilotStagedFile>();
  const skipped: { issueId: string; reason: string }[] = [];

  const tools = {
    listFiles: tool({
      description:
        "List repository files under a directory. Use an empty string for the whole repository.",
      inputSchema: z.object({ directory: z.string() }),
      execute: async ({ directory }) => {
        const prefix = directory.replace(/^\/+|\/+$/g, "");
        const matches = paths
          .filter((path) => !prefix || path.startsWith(`${prefix}/`))
          .slice(0, AUTOPILOT_TREE_MAX_PATHS);
        await log.info(`Listed ${prefix || "/"}`, { files: matches.length });
        return matches.join("\n") || "(no files)";
      },
    }),
    readFile: tool({
      description: "Read one repository file.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        if (
          !(
            existingPaths.has(path) ||
            (isSafeRepositoryPath(path) &&
              (await repositoryPathExists(octokit, repository, path, baseSha)))
          )
        ) {
          return "File does not exist.";
        }
        const content = await readRepositoryFile(
          octokit,
          repository,
          path,
          baseSha
        );
        if (content === null) {
          return "File could not be read.";
        }
        const truncated = content.length > AUTOPILOT_CONTEXT_FILE_MAX_CHARS;
        if (!truncated) {
          fullyRead.add(path);
        }
        await log.info(`Read ${path}`, { chars: content.length, truncated });
        return truncated
          ? `${content.slice(0, AUTOPILOT_CONTEXT_FILE_MAX_CHARS)}\n(truncated: this file is too large to replace)`
          : content;
      },
    }),
    writeFile: tool({
      description:
        "Stage the complete new content of one file for the pull request.",
      inputSchema: z.object({
        path: z.string().describe("Repository-relative path"),
        content: z.string().describe("Complete new file content"),
        issueIds: z.array(z.string()),
        reason: z.string(),
      }),
      execute: async (file) => {
        let rejection: string | null = null;
        if (!isSafeRepositoryPath(file.path) || isProtectedPath(file.path)) {
          rejection = "This path is not allowed.";
        } else if (
          !fullyRead.has(file.path) &&
          (existingPaths.has(file.path) ||
            // The tree listing can be truncated; ask GitHub before calling it new.
            (await repositoryPathExists(
              octokit,
              repository,
              file.path,
              baseSha
            )))
        ) {
          rejection = "Read the whole file before replacing it.";
        } else if (
          !staged.has(file.path) &&
          staged.size >= AUTOPILOT_FIX_MAX_FILES
        ) {
          rejection = `You already staged ${AUTOPILOT_FIX_MAX_FILES} files.`;
        }
        if (rejection) {
          await log.skip(`Rejected write to ${file.path}`, {
            reason: rejection,
          });
          return `Rejected: ${rejection}`;
        }
        const fileIssueIds = file.issueIds.filter((id) => issueIds.has(id));
        staged.set(file.path, { ...file, issueIds: fileIssueIds });
        await log.action(
          `${existingPaths.has(file.path) ? "Changed" : "Created"} ${file.path}`,
          { issueIds: fileIssueIds, reason: file.reason }
        );
        return "Staged.";
      },
    }),
    skipIssue: tool({
      description: "Leave an issue alone and say why.",
      inputSchema: z.object({ issueId: z.string(), reason: z.string() }),
      execute: async (skip) => {
        skipped.push(skip);
        const name =
          params.issues.find((issue) => issue.id === skip.issueId)?.name ??
          skip.issueId;
        await log.decision(`Left "${name}" alone`, { reason: skip.reason });
        return "Noted.";
      },
    }),
  };

  const agent = new ToolLoopAgent({
    model: gateway(AGENT_DEFAULT_MODEL, {
      organizationId: ctx.organizationId,
    }),
    providerOptions: withRouterDefaults(
      { gateway: { tags: ["autopilot", "readiness-agent"] } },
      { modelId: AGENT_DEFAULT_MODEL }
    ),
    instructions: READINESS_AGENT_INSTRUCTIONS,
    tools,
    output: Output.object({ schema: readinessAgentOutputSchema }),
    stopWhen: isStepCount(AUTOPILOT_READINESS_AGENT_MAX_STEPS),
    ...buildTelemetryOptions({
      feature: "autopilot",
      organizationId: ctx.organizationId,
      routeName: "autopilot/readiness-agent",
    }),
  });

  const startedAt = Date.now();
  let stepNumber = 0;
  const prompt = [
    `Brand: ${ctx.brand?.name ?? "unknown"}. ${ctx.brand?.description ?? ""}`,
    `Website: ${params.targetUrl}`,
    `Repository: ${repository.owner}/${repository.name} (branch ${repository.branch}, ${paths.length} files)`,
    "",
    buildAgentReadinessAllFixesPrompt(params.targetUrl, params.issues),
    "",
    `Use these exact issue ids in writeFile and skipIssue: ${[...issueIds].join(", ")}`,
    "",
    "## Repository layout",
    summarizeRepositoryTree(paths, AUTOPILOT_TREE_SUMMARY_MAX_LINES),
  ].join("\n");
  await log.trace("Readiness agent prompt", {
    model: AGENT_DEFAULT_MODEL,
    instructions: READINESS_AGENT_INSTRUCTIONS,
    prompt,
  });
  const result = await agent.generate({
    prompt,
    onStepEnd: async (step) => {
      stepNumber += 1;
      await log.trace(`Agent step ${stepNumber}`, {
        text: step.text,
        reasoning: step.reasoningText ?? null,
        toolCalls: step.toolCalls.map((call) => ({
          tool: call.toolName,
          input: call.input,
        })),
        toolResults: step.toolResults.map((toolResult) => ({
          tool: toolResult.toolName,
          output: toolResult.output,
        })),
        inputTokens: step.usage.inputTokens ?? null,
        outputTokens: step.usage.outputTokens ?? null,
      });
    },
  });
  params.onUsage({
    ...toAgentTokenUsage(result.totalUsage),
    modelId: AGENT_DEFAULT_MODEL,
  });
  await log.action(
    `Agent finished with ${AGENT_DEFAULT_MODEL}`,
    {
      model: AGENT_DEFAULT_MODEL,
      steps: result.steps.length,
      inputTokens: result.totalUsage.inputTokens ?? null,
      outputTokens: result.totalUsage.outputTokens ?? null,
      durationMs: Date.now() - startedAt,
      staged: staged.size,
    },
    { output: result.output, skipped }
  );
  return {
    octokit,
    baseSha,
    output: result.output,
    files: [...staged.values()],
    skipped,
  };
}

/** Lets the agent fix the issues and opens the pull request; true once it is open. */
async function openReadinessFix(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  claim: FindingClaim;
  repository: AutopilotRepository;
  readiness: { targetUrl: string };
  report: AutopilotReadinessReport;
  issues: AgentReadinessIssue[];
  onUsage: (usage: AgentTokenUsage) => void;
}): Promise<boolean> {
  const { ctx, log, claim, repository, readiness, report, issues } = params;
  try {
    const { octokit, baseSha, output, files, skipped } =
      await withAutopilotFindingLease(claim, () =>
        runReadinessAgent({
          ctx,
          repository,
          targetUrl: readiness.targetUrl,
          issues,
          log,
          onUsage: params.onUsage,
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
      return false;
    }
    const fixedIds = [...new Set(files.flatMap((file) => file.issueIds))];
    const fixedNames = issues
      .filter((issue) => fixedIds.includes(issue.id))
      .map((issue) => issue.name);
    const body = [
      output.pullRequestBody,
      "",
      `Scan: ${readiness.targetUrl} · Readiness: ${Math.round(report.score)}/100 · Framework: ${output.framework}.`,
    ].join("\n");
    await assertAutopilotFindingLease(claim);
    const pullRequest = await openAutopilotPullRequest({
      octokit,
      repository,
      slug: autopilotDraftBranchSlug("readiness", claim),
      baseSha,
      title: output.pullRequestTitle,
      body,
      files: files.map((file) => ({ path: file.path, contents: file.content })),
    });
    const recorded = await markFindingProposed(
      claim,
      {
        repository: `${repository.owner}/${repository.name}`,
        ...pullRequest,
      },
      {
        title: output.pullRequestTitle,
        summary:
          fixedNames.length > 0
            ? `Fixes ${fixedNames.join(", ")}`
            : `Changes ${files.map((file) => file.path).join(", ")}`,
        // Only what the pull request touches: dismissing it must not mute issues it left alone.
        evidence: {
          sourceUrl: report.reportUrl ?? readiness.targetUrl,
          score: report.score,
          issueIds: fixedIds,
        },
      }
    );
    if (!recorded) {
      await closeAutopilotPullRequest(octokit, repository, pullRequest);
      await log.skip("Dismissed while fixing, so the pull request was closed");
      return false;
    }
    await log.action(`Opened pull request #${pullRequest.number}`, {
      event: AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
      url: pullRequest.url,
      files: files.map((file) => file.path),
    });
    return true;
  } catch (error) {
    const gaveUp = await markFindingFailed(claim, error);
    await log.error(
      gaveUp
        ? `Readiness fix failed again; gave up after ${AUTOPILOT_FINDING_MAX_FAILURES} tries`
        : "Readiness fix failed; tried again on the next run",
      { error: toErrorMessage(error, String(error)) }
    );
    return false;
  }
}

export async function runReadinessJob(
  ctx: AutopilotRunContext
): Promise<AutopilotJobResult> {
  const result: AutopilotJobResult = { findingIds: [], insights: [] };
  const log = createAutopilotLogger(ctx, "readiness");
  const repository = ctx.repository;
  if (!repository) {
    await log.skip("No website repository connected");
    return result;
  }
  // Checked before rescanning so an open PR doesn't cost a scan every day.
  if (await hasOpenProposal(ctx.organizationId, ["readiness"])) {
    await log.skip("A readiness pull request is still waiting for review");
    return result;
  }
  const readiness = await loadFreshReadinessReport(ctx, log);
  const report = readiness.report;
  if (!report || report.score === null) {
    await log.skip("No completed readiness scan yet");
    return result;
  }
  const score = report.score;
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
    return result;
  }
  const issueIds = issues.map((issue) => issue.id).sort();
  const claim = await claimFinding(ctx.organizationId, ctx.runId, {
    kind: "readiness",
    // Keyed by the issue set, not the report: daily rescans keep the same
    // fingerprint, so a dismissed fix stays dismissed until the issues change.
    fingerprint: `readiness:${createHash("sha256").update(issueIds.join(",")).digest("hex").slice(0, 16)}`,
    title: `Agent readiness ${Math.round(report.score)}/100: ${issues.length} fixable issues`,
    summary: issues
      .slice(0, 4)
      .map((issue) => issue.name)
      .join(", "),
    evidence: {
      sourceUrl: report.reportUrl ?? readiness.targetUrl,
      score: report.score,
      issueIds,
    },
  });
  if (!claim) {
    await log.skip(
      "These issues are already being fixed, proposed, merged or dismissed"
    );
    return result;
  }
  const finding = claim.finding;
  result.findingIds.push(finding.id);

  const slot = await reserveDraftSlot(claim, ctx.maxOpenPullRequests);
  if (slot !== "reserved") {
    if (slot === "full") {
      await markFindingFailed(
        claim,
        "The workspace's draft pull request limit is already in use",
        { count: false }
      );
      await log.skip(
        "The workspace's draft pull request limit is already in use"
      );
    }
    return result;
  }

  const billed = await withAutopilotDraftBilling({
    claim,
    log,
    onReservationFailure: "fail",
    opened: (opened: boolean) => opened,
    run: (onUsage) =>
      openReadinessFix({
        ctx,
        log,
        claim,
        repository,
        readiness,
        report: { ...report, score },
        issues,
        onUsage,
      }),
  });
  if (!billed.allowed) {
    // Tried again tomorrow, when there may be credits again.
    await markFindingFailed(claim, "No credits left", { count: false });
  }
  return result;
}
