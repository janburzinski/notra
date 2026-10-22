import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  brandSettings,
  organizations,
  projects,
} from "@notra/db/schema";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_RUN_LEASE_MS,
} from "@/constants/autopilot";
import {
  runCommitsJob,
  runCompetitorsJob,
  runKeywordsJob,
} from "@/lib/autopilot/blog";
import { buildAutopilotBrief, postAutopilotBrief } from "@/lib/autopilot/brief";
import {
  countOpenPullRequests,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  withAutopilotRunLease,
  renewAutopilotRunLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { runPromptsJob } from "@/lib/autopilot/prompts";
import { runReadinessJob } from "@/lib/autopilot/readiness";
import type {
  AutopilotJobResult,
  AutopilotRunContext,
} from "@/types/autopilot";
import type { AutopilotRunTrigger } from "@/types/autopilot-runtime";
import { toAutopilotCommitFilters } from "@/utils/autopilot-commit-filters";
import { toErrorMessage } from "@/utils/error-message";

class AutopilotNotConfiguredError extends Error {
  override name = "AutopilotNotConfiguredError";
}

/** Creates the run row; a run already in progress is returned instead of a new one. */
export async function claimAutopilotRun(
  organizationId: string,
  trigger: AutopilotRunTrigger
): Promise<{ runId: string; alreadyRunning: boolean }> {
  // A launch that died before the workflow started leaves a running row behind;
  // past the lease it is marked failed so it stops blocking new runs.
  await db
    .update(autopilotRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: "Run did not finish in time",
    })
    .where(
      and(
        eq(autopilotRuns.organizationId, organizationId),
        eq(autopilotRuns.status, "running"),
        lt(
          autopilotRuns.heartbeatAt,
          new Date(Date.now() - AUTOPILOT_RUN_LEASE_MS)
        )
      )
    );
  const runId = nanoid();
  const inserted = await db
    .insert(autopilotRuns)
    // Set from the app clock like finishedAt, so durations never mix in the database timezone.
    .values({
      id: runId,
      organizationId,
      trigger,
      startedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: autopilotRuns.id });
  if (inserted.length > 0) {
    return { runId, alreadyRunning: false };
  }
  const running = await db.query.autopilotRuns.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotRuns.organizationId, organizationId),
      eq(autopilotRuns.status, "running"),
      inArray(autopilotRuns.trigger, [...AUTOPILOT_SCHEDULED_TRIGGERS])
    ),
  });
  if (!running) {
    throw new Error("Could not claim an Autopilot run");
  }
  return { runId: running.id, alreadyRunning: true };
}

/** A run for one item (a mention, a merge, a suggestion); it may overlap the scheduled run. */
export async function createItemAutopilotRun(
  organizationId: string,
  trigger: "github" | "suggestion"
) {
  const runId = nanoid();
  await db.insert(autopilotRuns).values({
    id: runId,
    organizationId,
    trigger,
    startedAt: new Date(),
    heartbeatAt: new Date(),
  });
  return runId;
}

/** The saved GEO project, or the workspace's first one when none is saved. */
export function findAutopilotProject(
  organizationId: string,
  projectId: string | null
) {
  return projectId
    ? db.query.projects.findFirst({
        where: and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId)
        ),
      })
    : db.query.projects.findFirst({
        where: eq(projects.organizationId, organizationId),
        orderBy: [asc(projects.createdAt)],
      });
}

export async function buildAutopilotRunContext(
  organizationId: string,
  runId: string
): Promise<AutopilotRunContext> {
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    throw new Error("Autopilot is not available for this workspace.");
  }
  const [settings, organization] = await Promise.all([
    db.query.autopilotSettings.findFirst({
      where: eq(autopilotSettings.organizationId, organizationId),
    }),
    db.query.organizations.findFirst({
      columns: { slug: true },
      where: eq(organizations.id, organizationId),
    }),
  ]);
  if (!(settings && organization)) {
    throw new AutopilotNotConfiguredError("Autopilot is not set up");
  }
  if (!settings.enabled) {
    throw new Error("Autopilot is turned off for this workspace.");
  }
  const project = await findAutopilotProject(
    organizationId,
    settings.projectId
  );
  const brand = project
    ? await db.query.brandSettings.findFirst({
        where: eq(brandSettings.id, project.brandSettingsId),
      })
    : null;

  const repository =
    settings.repositoryOwner && settings.repositoryName
      ? {
          owner: settings.repositoryOwner,
          name: settings.repositoryName,
          branch: settings.repositoryBranch ?? "main",
        }
      : null;

  return {
    organizationId,
    organizationSlug: organization.slug,
    runId,
    projectId: project?.id ?? null,
    repository,
    contentPath: settings.contentPath,
    jobs: { ...AUTOPILOT_DEFAULT_JOBS, ...settings.jobs },
    maxOpenPullRequests: settings.maxOpenPullRequests,
    stalePullRequestDays: settings.stalePullRequestDays,
    commitFilters: toAutopilotCommitFilters(settings.commitFilters),
    brand: brand
      ? {
          name: brand.companyName ?? brand.name,
          websiteUrl: brand.websiteUrl,
          description: brand.companyDescription ?? "",
          audience: brand.audience ?? null,
          language: brand.language ?? "English",
          customInstructions: brand.customInstructions ?? null,
          settingsId: brand.id,
        }
      : null,
  };
}

const JOB_RUNNERS: Record<
  AutopilotJobKind,
  (ctx: AutopilotRunContext) => Promise<AutopilotJobResult>
> = {
  readiness: runReadinessJob,
  keywords: runKeywordsJob,
  commits: runCommitsJob,
  prompts: runPromptsJob,
  competitors: runCompetitorsJob,
};

/** Pull-request producing jobs stop once the open pull request budget is used up. */
const PULL_REQUEST_JOBS = new Set<AutopilotJobKind>([
  "readiness",
  "keywords",
  "commits",
]);

export async function runAutopilotJob(
  ctx: AutopilotRunContext,
  kind: AutopilotJobKind
): Promise<AutopilotJobResult> {
  const empty: AutopilotJobResult = { findingIds: [], insights: [] };
  const log = createAutopilotLogger(ctx, kind);
  if (!(await renewAutopilotRunLease(ctx))) {
    await log.skip("This run no longer owns its lease");
    return empty;
  }
  // Competitors is one line in the brief, not an automation with a switch.
  if (!(kind === "competitors" || ctx.jobs[kind])) {
    await log.skip("Turned off in settings");
    return empty;
  }
  if (PULL_REQUEST_JOBS.has(kind)) {
    // A replayed step returns what it already proposed instead of picking another candidate.
    const claimed = await db
      .select({ id: autopilotFindings.id })
      .from(autopilotFindings)
      .where(
        and(
          eq(autopilotFindings.organizationId, ctx.organizationId),
          eq(autopilotFindings.runId, ctx.runId),
          eq(autopilotFindings.kind, kind)
        )
      );
    if (claimed.length > 0) {
      // The step died after claiming; whatever it left mid-write is retried
      // tomorrow instead of being counted as done.
      await db
        .update(autopilotFindings)
        .set({
          status: "failed",
          claimToken: null,
          errorMessage: "Interrupted before the pull request was opened",
        })
        .where(
          and(
            eq(autopilotFindings.runId, ctx.runId),
            eq(autopilotFindings.kind, kind),
            eq(autopilotFindings.status, "open")
          )
        );
      return { ...empty, findingIds: claimed.map((row) => row.id) };
    }
    // PRs merged or closed on GitHub since the last run free up the budget.
    await syncFindingPullRequests(ctx.organizationId);
    const open = await countOpenPullRequests(ctx.organizationId);
    if (open >= ctx.maxOpenPullRequests) {
      await log.skip(
        `${open} of ${ctx.maxOpenPullRequests} pull requests are still open`
      );
      return empty;
    }
  }
  try {
    return await withAutopilotRunLease(ctx, () => JOB_RUNNERS[kind](ctx));
  } catch (error) {
    await log.error("Job failed", {
      error: toErrorMessage(error, String(error)),
    });
    return empty;
  }
}

export async function deliverAutopilotBrief(params: {
  ctx: AutopilotRunContext;
  results: AutopilotJobResult[];
  previousRunAt: Date | null;
}) {
  const { ctx, results } = params;
  const recorded = await db.query.autopilotRuns.findFirst({
    columns: { slackMessageTs: true },
    where: and(
      eq(autopilotRuns.id, ctx.runId),
      eq(autopilotRuns.organizationId, ctx.organizationId)
    ),
  });
  if (recorded?.slackMessageTs) {
    return recorded.slackMessageTs;
  }
  if (!(await renewAutopilotRunLease(ctx))) {
    throw new Error("The run no longer owns its delivery lease");
  }
  await syncFindingPullRequests(ctx.organizationId);
  // Item workflows are independent of the daily run. Announce each state once,
  // even after disconnected Slack or a failed earlier brief.
  const findings = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      inArray(autopilotFindings.status, ["suggested", "proposed"]),
      sql`not coalesce((${autopilotFindings.evidence}->'briefed') ? ${autopilotFindings.status}, false)`
    ),
    orderBy: [asc(autopilotFindings.createdAt)],
    limit: 10,
  });
  const merged = params.previousRunAt
    ? await db.query.autopilotFindings.findMany({
        where: and(
          eq(autopilotFindings.organizationId, ctx.organizationId),
          eq(autopilotFindings.status, "merged"),
          gte(autopilotFindings.mergedAt, params.previousRunAt)
        ),
      })
    : [];
  const brief = buildAutopilotBrief({
    organizationSlug: ctx.organizationSlug,
    proposed: findings.filter((finding) => finding.status === "proposed"),
    suggested: findings.filter((finding) => finding.status === "suggested"),
    merged,
    insights: results.flatMap((result) => result.insights),
  });
  const log = createAutopilotLogger(ctx, null);
  if (!brief) {
    await log.skip("No brief: nothing proposed, merged or worth knowing");
    return null;
  }
  try {
    if (!(await renewAutopilotRunLease(ctx))) {
      throw new Error("The run no longer owns its delivery lease");
    }
    const ts = await postAutopilotBrief(ctx.organizationId, brief, ctx.runId);
    if (ts) {
      await db.transaction(async (tx) => {
        const recorded = await tx
          .update(autopilotRuns)
          .set({ slackMessageTs: ts })
          .where(
            and(
              eq(autopilotRuns.id, ctx.runId),
              eq(autopilotRuns.organizationId, ctx.organizationId),
              eq(autopilotRuns.status, "running")
            )
          )
          .returning({ id: autopilotRuns.id });
        if (!recorded.length) {
          throw new Error("The run lost its delivery lease");
        }
        const visibleFindingIds = new Set(brief.findingIds);
        for (const status of ["suggested", "proposed"] as const) {
          const ids = findings
            .filter(
              (finding) =>
                finding.status === status && visibleFindingIds.has(finding.id)
            )
            .map((finding) => finding.id);
          if (!ids.length) {
            continue;
          }
          await tx
            .update(autopilotFindings)
            .set({
              evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{briefed}', coalesce(${autopilotFindings.evidence}->'briefed', '[]'::jsonb) || jsonb_build_array(${status}::text))`,
            })
            .where(
              and(
                eq(autopilotFindings.organizationId, ctx.organizationId),
                inArray(autopilotFindings.id, ids)
              )
            );
        }
      });
      await log.action("Posted the brief to Slack");
    } else {
      await log.skip("No brief sent: Slack is not connected");
    }
    return ts;
  } catch (error) {
    await log.error("Could not post the brief", {
      error: toErrorMessage(error, String(error)),
    });
    return null;
  }
}

export async function finishAutopilotRun(params: {
  organizationId: string;
  runId: string;
  results: AutopilotJobResult[];
  slackMessageTs: string | null;
  error?: string;
  /** Mention runs leave the schedule alone so the daily run still happens. */
  scheduled?: boolean;
}) {
  const findingIds = params.results.flatMap((result) => result.findingIds);
  const findings =
    findingIds.length > 0
      ? await db
          .select({ status: autopilotFindings.status })
          .from(autopilotFindings)
          .where(
            and(
              eq(autopilotFindings.organizationId, params.organizationId),
              inArray(autopilotFindings.id, findingIds)
            )
          )
      : [];
  const finishedAt = new Date();
  const completed = await db
    .update(autopilotRuns)
    .set({
      status: params.error ? "failed" : "completed",
      errorMessage: params.error ?? null,
      slackMessageTs: params.slackMessageTs ?? undefined,
      finishedAt,
      summary: {
        findings: findings.length,
        proposed: findings.filter((row) => row.status === "proposed").length,
        failed: findings.filter((row) => row.status === "failed").length,
        insights: params.results.flatMap((result) => result.insights),
      },
    })
    .where(
      and(
        eq(autopilotRuns.id, params.runId),
        eq(autopilotRuns.organizationId, params.organizationId),
        eq(autopilotRuns.status, "running")
      )
    )
    .returning({ id: autopilotRuns.id });
  if (params.scheduled === false || completed.length === 0) {
    return;
  }
  await db
    .update(autopilotSettings)
    .set({ lastRunAt: finishedAt })
    .where(eq(autopilotSettings.organizationId, params.organizationId));
}
