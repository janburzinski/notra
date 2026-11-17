import { db } from "@notra/db/drizzle";
import {
  geoAgentReadinessReports,
  geoMentionChecks,
  geoScans,
  projects,
} from "@notra/db/schema";
import type { AutopilotImpactTarget } from "@notra/db/types/autopilot";
import { gapScanIds, promptIdFromScanId } from "@notra/geo-core/geo/prompts";
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  AUTOPILOT_IMPACT_WINDOW_MS,
  AUTOPILOT_KEYWORD_MAX_MENTION_RATE,
  AUTOPILOT_SUSTAINED_GAP_LOOKBACK_MS,
  AUTOPILOT_SUSTAINED_GAP_MIN_SCANS,
  AUTOPILOT_SUSTAINED_GAP_MIN_SPAN_MS,
} from "@/constants/autopilot";
import {
  AUTOPILOT_OUTCOME_MAX_CITING_ROWS,
  AUTOPILOT_OUTCOME_MIN_CITATIONS,
} from "@/constants/autopilot-outcome";
import type {
  AutopilotEngineTally,
  AutopilotImpact,
  AutopilotFindingRow as FindingRow,
} from "@/types/autopilot-runtime";
import { citationKey } from "@/utils/autopilot-citations";
import { pairedEngineRates, pooledRate } from "@/utils/autopilot-outcome";

const NOT_PLAIN_URL = /[^a-z0-9/.\-_]+/gi;
const LIKE_UNDERSCORE = /_/g;

/** First-turn answers per engine in (from, to], and how many named the brand. */
async function mentionTallies(
  projectId: string,
  promptId: string,
  from: Date,
  to: Date
) {
  const rows = await db
    .select({
      engine: geoMentionChecks.engine,
      total: count(),
      hits: sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
        Number
      ),
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, gapScanIds(promptId)),
        gt(geoMentionChecks.capturedAt, from),
        lte(geoMentionChecks.capturedAt, to)
      )
    )
    .groupBy(geoMentionChecks.engine);
  return new Map<string, AutopilotEngineTally>(
    rows.map((row) => [row.engine, { total: row.total, hits: row.hits }])
  );
}

/**
 * The window before the finding was created and the latest window since the
 * merge, each at most AUTOPILOT_IMPACT_WINDOW_MS long.
 */
function impactWindows(finding: FindingRow, mergedAt: Date, now: Date) {
  return {
    before: {
      from: new Date(finding.createdAt.getTime() - AUTOPILOT_IMPACT_WINDOW_MS),
      to: finding.createdAt,
    },
    after: {
      from: new Date(
        Math.max(mergedAt.getTime(), now.getTime() - AUTOPILOT_IMPACT_WINDOW_MS)
      ),
      to: now,
    },
  };
}

/**
 * Before and after from the stored answers, over the same engines. Findings
 * from before any stored answer keep the before they saved and compare it
 * with every engine since.
 */
function compareTallies(
  stored: number,
  before: ReadonlyMap<string, AutopilotEngineTally>,
  after: ReadonlyMap<string, AutopilotEngineTally>
) {
  if (before.size === 0) {
    return { before: stored, after: pooledRate(after) };
  }
  return pairedEngineRates(before, after) ?? { before: stored, after: null };
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
 * window: the "before" a finding saves when it is created. Prompts
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

/** First-turn answers per engine to the page's prompts in (from, to], and how many cited it. */
async function citationTallies(
  projectId: string,
  target: Extract<AutopilotImpactTarget, { kind: "citations" }>,
  from: Date,
  to: Date
) {
  const tallies = new Map<string, AutopilotEngineTally>();
  const key = citationKey(target.url);
  if (!key || target.promptIds.length === 0) {
    return tallies;
  }
  const rows = await db
    .select({
      engine: geoMentionChecks.engine,
      grounding: geoMentionChecks.grounding,
      sources: geoMentionChecks.sources,
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        eq(geoMentionChecks.turn, 0),
        inArray(geoMentionChecks.promptId, target.promptIds),
        gt(geoMentionChecks.capturedAt, from),
        lte(geoMentionChecks.capturedAt, to)
      )
    );
  for (const row of rows) {
    const tally = tallies.get(row.engine) ?? { total: 0, hits: 0 };
    tally.total += 1;
    if (citesPage(row, key)) {
      tally.hits += 1;
    }
    tallies.set(row.engine, tally);
  }
  return tallies;
}

function citesPage(
  row: {
    grounding: { sources: { url: string }[] };
    sources: { url: string }[];
  },
  key: string
) {
  return [...row.grounding.sources, ...row.sources].some(
    (source) => citationKey(source.url) === key
  );
}

/**
 * Answers scanned since the merge, and how many of them cite the page. A new
 * post's page did not exist before, so any citation is the post's doing.
 * Answers are prefiltered by the page's path in SQL; most cite other pages.
 */
export async function countPageCitations(
  projectId: string,
  url: string,
  since: Date
) {
  const key = citationKey(url);
  const path = key?.slice(key.indexOf("/")) ?? "";
  const [answered] = await db
    .select({ total: count() })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        gt(geoMentionChecks.capturedAt, since)
      )
    );
  const answers = answered?.total ?? 0;
  if (!key || path.length <= 1) {
    return { answers, citations: null };
  }
  // citationKey decodes the path, but a stored source may encode any part of
  // it: every character other than plain URL letters matches anything here,
  // and citesPage compares the normalized URLs exactly.
  const pattern = `%${path.replace(NOT_PLAIN_URL, "%").replace(LIKE_UNDERSCORE, "\\_")}%`;
  const rows = await db
    .select({
      grounding: geoMentionChecks.grounding,
      sources: geoMentionChecks.sources,
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        gt(geoMentionChecks.capturedAt, since),
        or(
          ilike(sql`${geoMentionChecks.sources}::text`, pattern),
          ilike(sql`${geoMentionChecks.grounding}::text`, pattern)
        )
      )
    )
    .limit(AUTOPILOT_OUTCOME_MAX_CITING_ROWS);
  const citations = rows.filter((row) => citesPage(row, key)).length;
  // At the limit, answers past it may cite the page too: below the bar that
  // is unknown, not zero.
  const cutOff = rows.length >= AUTOPILOT_OUTCOME_MAX_CITING_ROWS;
  return {
    answers,
    citations:
      cutOff && citations < AUTOPILOT_OUTCOME_MIN_CITATIONS ? null : citations,
  };
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
 * Search Console position for its query, or the readiness score. Mentions and
 * citations compare the same engines in both windows. After stays null until
 * there is data from after the merge. Reads only what scans and syncs already
 * stored; no model calls.
 */
export async function loadFindingImpacts(
  project: Pick<
    typeof projects.$inferSelect,
    "id" | "gscTopQueries" | "gscLastSyncedAt"
  > | null,
  findings: FindingRow[],
  now = new Date()
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
        if (!mergedAt) {
          impacts[finding.id] = {
            metric: "mentions",
            before: target.before,
            after: null,
          };
          return;
        }
        const windows = impactWindows(finding, mergedAt, now);
        const [before, after] = await Promise.all([
          mentionTallies(
            projectId,
            target.promptId,
            windows.before.from,
            windows.before.to
          ),
          mentionTallies(
            projectId,
            target.promptId,
            windows.after.from,
            windows.after.to
          ),
        ]);
        impacts[finding.id] = {
          metric: "mentions",
          ...compareTallies(target.before, before, after),
        };
      } else if (target?.kind === "citations") {
        if (!mergedAt) {
          impacts[finding.id] = {
            metric: "citations",
            before: target.before,
            after: null,
          };
          return;
        }
        const windows = impactWindows(finding, mergedAt, now);
        const [before, after] = await Promise.all([
          citationTallies(
            projectId,
            target,
            windows.before.from,
            windows.before.to
          ),
          citationTallies(
            projectId,
            target,
            windows.after.from,
            windows.after.to
          ),
        ]);
        impacts[finding.id] = {
          metric: "citations",
          ...compareTallies(target.before, before, after),
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
