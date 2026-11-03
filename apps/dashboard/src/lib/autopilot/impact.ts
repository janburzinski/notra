import { db } from "@notra/db/drizzle";
import {
  geoAgentReadinessReports,
  geoMentionChecks,
  projects,
} from "@notra/db/schema";
import type { AutopilotImpactTarget } from "@notra/db/types/autopilot";
import { gapScanIds } from "@notra/geo-core/geo/prompts";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { AUTOPILOT_IMPACT_WINDOW_MS } from "@/constants/autopilot";
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
