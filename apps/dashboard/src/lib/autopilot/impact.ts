import { db } from "@notra/db/drizzle";
import {
  geoAgentReadinessReports,
  geoMentionChecks,
  geoScans,
  projects,
} from "@notra/db/schema";
import type { AutopilotImpactTarget } from "@notra/db/types/autopilot";
import { gapScanIds, promptIdFromScanId } from "@notra/geo-core/geo/prompts";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  AUTOPILOT_IMPACT_WINDOW_MS,
  AUTOPILOT_KEYWORD_MAX_MENTION_RATE,
  AUTOPILOT_SUSTAINED_GAP_LOOKBACK_MS,
  AUTOPILOT_SUSTAINED_GAP_MIN_SCANS,
  AUTOPILOT_SUSTAINED_GAP_MIN_SPAN_MS,
} from "@/constants/autopilot";
import type {
  AutopilotImpact,
  AutopilotFindingRow as FindingRow,
} from "@/types/autopilot-runtime";
import { citationKey } from "@/utils/autopilot-citations";

/** Share of first-turn answers naming the brand since the merge, at most the last window. */
async function mentionRateSince(
  projectId: string,
  promptId: string,
  mergedAt: Date
) {
  const since = new Date(
    Math.max(mergedAt.getTime(), Date.now() - AUTOPILOT_IMPACT_WINDOW_MS)
  );
  const [row] = await db
    .select({
      total: count(),
      mentioned:
        sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
          Number
        ),
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, gapScanIds(promptId)),
        gt(geoMentionChecks.capturedAt, since)
      )
    );
  return row && row.total > 0 ? row.mentioned / row.total : null;
}

/**
 * Prompts the brand was missing from in several separate scans days apart,
 * the latest one included, with how many scans and over how many days. A
 * scan counts when the brand is missing from at least half of that scan's
 * answers, the same bar a gap has to clear. Re-reading one snapshot every day
 * is not persistence; separate scans are.
 */
export async function sustainedGaps(
  projectId: string,
  promptIds: readonly string[]
) {
  const sustained = new Map<string, { scans: number; days: number }>();
  if (promptIds.length === 0) {
    return sustained;
  }
  const rows = await db
    .select({
      scanPromptId: geoMentionChecks.promptId,
      scanId: geoMentionChecks.scanId,
      total: count(),
      mentioned:
        sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
          Number
        ),
      at: sql<Date>`max(${geoMentionChecks.capturedAt})`.mapWith(
        (value) => new Date(value)
      ),
    })
    .from(geoMentionChecks)
    // Only finished scans: one still running has saved some engines and not
    // others, so its share says nothing yet.
    .innerJoin(
      geoScans,
      and(
        eq(geoScans.id, geoMentionChecks.scanId),
        eq(geoScans.status, "completed")
      )
    )
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, promptIds.flatMap(gapScanIds)),
        gt(
          geoMentionChecks.capturedAt,
          new Date(Date.now() - AUTOPILOT_SUSTAINED_GAP_LOOKBACK_MS)
        )
      )
    )
    .groupBy(geoMentionChecks.promptId, geoMentionChecks.scanId);
  const scansByPrompt = new Map<string, { missed: boolean; at: Date }[]>();
  for (const row of rows) {
    const promptId = promptIdFromScanId(row.scanPromptId);
    scansByPrompt.set(promptId, [
      ...(scansByPrompt.get(promptId) ?? []),
      {
        missed: row.mentioned / row.total <= AUTOPILOT_KEYWORD_MAX_MENTION_RATE,
        at: row.at,
      },
    ]);
  }
  for (const [promptId, scans] of scansByPrompt) {
    const latest = scans.reduce((a, b) => (b.at > a.at ? b : a));
    const missed = scans.filter((scan) => scan.missed);
    if (!latest.missed || missed.length < AUTOPILOT_SUSTAINED_GAP_MIN_SCANS) {
      continue;
    }
    const times = missed.map((scan) => scan.at.getTime());
    const spanMs = Math.max(...times) - Math.min(...times);
    if (spanMs >= AUTOPILOT_SUSTAINED_GAP_MIN_SPAN_MS) {
      sustained.set(promptId, {
        scans: missed.length,
        days: Math.round(spanMs / (24 * 60 * 60 * 1000)),
      });
    }
  }
  return sustained;
}

/**
 * Each prompt's share of first-turn answers naming the brand over the last
 * window: the "before" that mentionRateSince is later compared with. Prompts
 * without answers in the window are left out.
 */
export async function recentMentionRates(
  projectId: string,
  promptIds: readonly string[]
) {
  const rates = new Map<string, number>();
  if (promptIds.length === 0) {
    return rates;
  }
  const rows = await db
    .select({
      scanId: geoMentionChecks.promptId,
      total: count(),
      mentioned:
        sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
          Number
        ),
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, promptIds.flatMap(gapScanIds)),
        gt(
          geoMentionChecks.capturedAt,
          new Date(Date.now() - AUTOPILOT_IMPACT_WINDOW_MS)
        )
      )
    )
    .groupBy(geoMentionChecks.promptId);
  const totals = new Map<string, { total: number; mentioned: number }>();
  for (const row of rows) {
    const promptId = promptIdFromScanId(row.scanId);
    const sum = totals.get(promptId) ?? { total: 0, mentioned: 0 };
    sum.total += row.total;
    sum.mentioned += row.mentioned;
    totals.set(promptId, sum);
  }
  for (const [promptId, sum] of totals) {
    if (sum.total > 0) {
      rates.set(promptId, sum.mentioned / sum.total);
    }
  }
  return rates;
}

/** Share of first-turn answers to the page's prompts citing it since the merge. */
async function citationRateSince(
  projectId: string,
  target: Extract<AutopilotImpactTarget, { kind: "citations" }>,
  mergedAt: Date
) {
  const since = new Date(
    Math.max(mergedAt.getTime(), Date.now() - AUTOPILOT_IMPACT_WINDOW_MS)
  );
  const key = citationKey(target.url);
  if (!key || target.promptIds.length === 0) {
    return null;
  }
  const rows = await db
    .select({
      grounding: geoMentionChecks.grounding,
      sources: geoMentionChecks.sources,
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, target.promptIds),
        gt(geoMentionChecks.capturedAt, since)
      )
    );
  if (rows.length === 0) {
    return null;
  }
  const citing = rows.filter((row) =>
    [...row.grounding.sources, ...row.sources].some(
      (source) => citationKey(source.url) === key
    )
  );
  return citing.length / rows.length;
}

/** The first readiness score scanned after the merge. */
async function readinessScoreSince(projectId: string, mergedAt: Date) {
  const [row] = await db
    .select({ score: geoAgentReadinessReports.score })
    .from(geoAgentReadinessReports)
    .where(
      and(
        eq(geoAgentReadinessReports.projectId, projectId),
        eq(geoAgentReadinessReports.status, "completed"),
        gt(geoAgentReadinessReports.createdAt, mergedAt)
      )
    )
    .orderBy(desc(geoAgentReadinessReports.createdAt))
    .limit(1);
  return row?.score ?? null;
}

/**
 * Before and after for every merged pull request that has something to
 * measure: AI mentions for its prompt, AI citations of a refreshed page,
 * Search Console position for its query, or the readiness score. After stays null until there is data from after the
 * merge. Reads only what scans and syncs already stored; no model calls.
 */
export async function loadFindingImpacts(
  project: Pick<
    typeof projects.$inferSelect,
    "id" | "gscTopQueries" | "gscLastSyncedAt"
  > | null,
  findings: FindingRow[]
): Promise<Record<string, AutopilotImpact>> {
  const impacts: Record<string, AutopilotImpact> = {};
  if (!project) {
    return impacts;
  }
  const projectId = project.id;
  await Promise.all(
    findings.map(async (finding) => {
      const target = finding.evidence.target;
      const mergedAt =
        finding.status === "merged" ? (finding.mergedAt ?? null) : null;
      if (target?.kind === "prompt") {
        impacts[finding.id] = {
          metric: "mentions",
          before: target.before,
          after: mergedAt
            ? await mentionRateSince(projectId, target.promptId, mergedAt)
            : null,
        };
      } else if (target?.kind === "citations") {
        impacts[finding.id] = {
          metric: "citations",
          before: target.before,
          after: mergedAt
            ? await citationRateSince(projectId, target, mergedAt)
            : null,
        };
      } else if (target?.kind === "search") {
        const synced =
          mergedAt &&
          project.gscLastSyncedAt &&
          project.gscLastSyncedAt > mergedAt;
        const row = synced
          ? project.gscTopQueries.find(
              (query) =>
                query.query.toLowerCase() === target.query.toLowerCase()
            )
          : undefined;
        impacts[finding.id] = {
          metric: "position",
          before: target.before,
          after: row?.position ?? null,
        };
      } else if (
        finding.kind === "readiness" &&
        typeof finding.evidence.score === "number"
      ) {
        impacts[finding.id] = {
          metric: "score",
          before: finding.evidence.score,
          after: mergedAt
            ? await readinessScoreSince(projectId, mergedAt)
            : null,
        };
      }
    })
  );
  return impacts;
}
