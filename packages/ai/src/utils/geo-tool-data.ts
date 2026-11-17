import type { GEO_CHART_KINDS } from "@notra/ai/constants/chart-tools";
import {
  GEO_SCAN_RESULT_ANSWERS_LIMIT,
  GEO_SCAN_RESULT_COMPETITORS_LIMIT,
  GEO_SCAN_RESULT_EXCERPT_CHARS,
  GEO_TOOL_DEFAULT_COMPETITOR_LIMIT,
} from "@notra/ai/constants/geo-tools";
import {
  GEO_CONTEXT_LOOKBACK_DAYS,
  GEO_CONTEXT_MAX_ANSWER_CHARS,
  GEO_CONTEXT_MAX_CHECKS,
  GEO_CONTEXT_MAX_EXCERPT_CHARS,
} from "@notra/ai/constants/geo-writer";
import type { ChartArtifact } from "@notra/ai/types/chart-artifact";
import {
  buildGeoCompetitorShareChart,
  buildGeoOverviewChart,
  buildGeoTimeseriesChart,
} from "@notra/ai/utils/chart-artifact";
import { GEO_CONTEXT_COMPETITOR_LIMIT } from "@notra/db/constants/geo-context-competitors";
import { db } from "@notra/db/drizzle";
import {
  geoCompetitors,
  geoMentionChecks,
  geoPrompts,
  geoScans,
  geoSettings,
  projects,
} from "@notra/db/schema";
import {
  geoCheckInPromptLanguage,
  queryGeoCheckCompetitorShare,
  queryGeoCheckOverview,
  queryGeoCheckPromptResults,
  queryGeoCheckTimeseries,
  queryGeoScanAnswers,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { selectGeoContextCompetitors } from "@notra/db/utils/geo-context-competitors";
import { and, asc, desc, eq, gte, ilike, isNull, sql } from "drizzle-orm";

const LIKE_SPECIAL_CHARS_REGEX = /[%_\\]/g;

const MS_PER_DAY = 86_400_000;

const mentionCheckBaseColumns = {
  promptId: geoMentionChecks.promptId,
  engine: geoMentionChecks.engine,
  prompt: geoMentionChecks.prompt,
  mentioned: geoMentionChecks.mentioned,
  position: geoMentionChecks.position,
  sentiment: geoMentionChecks.sentiment,
  competitors: geoMentionChecks.competitors,
  excerpt: geoMentionChecks.excerpt,
  capturedAt: geoMentionChecks.capturedAt,
};

function geoScope(organizationId: string, projectId?: string) {
  return { organizationId, projectId: projectId ?? null };
}

export async function loadGeoProjectsForTool(organizationId: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      isSample: projects.isSample,
      companyName: geoSettings.companyName,
      trackingEnabled: geoSettings.enabled,
      lastScanAt: geoSettings.lastScanAt,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(
      geoSettings,
      and(
        eq(geoSettings.projectId, projects.id),
        eq(geoSettings.organizationId, organizationId)
      )
    )
    .where(eq(projects.organizationId, organizationId))
    .orderBy(asc(projects.createdAt));

  return {
    projects: rows.map((row) => ({
      id: row.id,
      name: row.name,
      is_sample: row.isSample,
      company_name: row.companyName,
      tracking_enabled: row.trackingEnabled,
      last_scan_at: row.lastScanAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    })),
    count: rows.length,
  };
}

export async function loadGeoOverviewForTool(
  organizationId: string,
  projectId: string | undefined,
  days: number
) {
  const scope = geoScope(organizationId, projectId);
  const window = toGeoCheckWindow({ days });
  const [overview, competitors] = await Promise.all([
    queryGeoCheckOverview(scope, window),
    queryGeoCheckCompetitorShare(
      scope,
      window,
      GEO_TOOL_DEFAULT_COMPETITOR_LIMIT
    ),
  ]);

  const engines = overview.map((row) => ({
    engine: row.engine,
    checks: row.checks,
    mentions: row.mentions,
    mention_rate: row.mentionRate,
    citations: row.citations,
    visibility: row.visibility,
    visibility_rate: row.visibilityRate,
    avg_position: row.avgPosition,
    last_checked_at: row.lastCheckedAt.toISOString(),
  }));

  return {
    project_id: scope.projectId,
    days,
    engines,
    competitor_share: competitors.map((row) => ({
      brand: row.brand,
      mentions: row.mentions,
    })),
  };
}

export async function loadGeoTimeseriesForTool(
  organizationId: string,
  projectId: string | undefined,
  days: number
) {
  const scope = geoScope(organizationId, projectId);
  const rows = await queryGeoCheckTimeseries(scope, toGeoCheckWindow({ days }));

  const points = rows.map((row) => ({
    day: row.day,
    engine: row.engine,
    checks: row.checks,
    mentions: row.mentions,
    citations: row.citations,
    visibility: row.visibility,
    mention_rate:
      row.checks === 0
        ? 0
        : Math.round((row.mentions / row.checks) * 1000) / 1000,
    visibility_rate:
      row.checks === 0
        ? 0
        : Math.round((row.visibility / row.checks) * 1000) / 1000,
    avg_position: row.avgPosition,
  }));

  return {
    project_id: scope.projectId,
    days,
    points,
  };
}

export async function loadGeoPromptResultsForTool(
  organizationId: string,
  projectId: string | undefined,
  days: number,
  limit: number,
  includeAnswers: boolean
) {
  const scope = geoScope(organizationId, projectId);
  const rows = await queryGeoCheckPromptResults(
    scope,
    toGeoCheckWindow({ days }),
    limit + 1
  );
  const results = rows.slice(0, limit).map((row) => {
    const base = {
      prompt_id: row.promptId,
      prompt: row.prompt,
      engine: row.engine,
      mentioned: row.mentioned,
      position: row.position,
      sentiment: row.sentiment,
      truncated: row.truncated,
      last_checked_at: row.lastCheckedAt.toISOString(),
    };
    return includeAnswers
      ? {
          ...base,
          answer: row.answer.slice(0, GEO_CONTEXT_MAX_ANSWER_CHARS),
        }
      : {
          ...base,
          excerpt: row.excerpt.slice(0, GEO_CONTEXT_MAX_EXCERPT_CHARS),
        };
  });

  return {
    project_id: scope.projectId,
    days,
    results,
    count: results.length,
    has_more: rows.length > limit,
  };
}

export async function loadGeoCompetitorShareForTool(
  organizationId: string,
  projectId: string | undefined,
  days: number,
  limit: number
) {
  const scope = geoScope(organizationId, projectId);
  const competitors = await queryGeoCheckCompetitorShare(
    scope,
    toGeoCheckWindow({ days }),
    limit
  );

  const competitorRows = competitors.map((row) => ({
    brand: row.brand,
    mentions: row.mentions,
  }));

  return {
    project_id: scope.projectId,
    days,
    competitors: competitorRows,
  };
}

/**
 * The chart the chat draws into an answer. Data tools return numbers only,
 * so a chart shows up where the model chose to show one, not after every
 * lookup.
 */
export async function loadGeoChartForTool(
  organizationId: string,
  chart: (typeof GEO_CHART_KINDS)[number],
  projectId: string | undefined,
  days: number
): Promise<{ project_id: string | null; days: number; chart: ChartArtifact }> {
  const scope = geoScope(organizationId, projectId);
  switch (chart) {
    case "engines": {
      const rows = await queryGeoCheckOverview(
        scope,
        toGeoCheckWindow({ days })
      );
      return {
        project_id: scope.projectId,
        days,
        chart: buildGeoOverviewChart({
          days,
          engines: rows.map((row) => ({
            engine: row.engine,
            mention_rate: row.mentionRate,
          })),
        }),
      };
    }
    case "trend": {
      const { points } = await loadGeoTimeseriesForTool(
        organizationId,
        projectId,
        days
      );
      return {
        project_id: scope.projectId,
        days,
        chart: buildGeoTimeseriesChart({ days, points }),
      };
    }
    case "competitors": {
      // All brands, so shares divide by the real total; the chart folds
      // the tail into one segment.
      const rows = await queryGeoCheckCompetitorShare(
        scope,
        toGeoCheckWindow({ days }),
        Number.MAX_SAFE_INTEGER
      );
      return {
        project_id: scope.projectId,
        days,
        chart: buildGeoCompetitorShareChart({
          days,
          competitors: rows.map((row) => ({
            brand: row.brand,
            mentions: row.mentions,
          })),
        }),
      };
    }
    default: {
      const exhaustive: never = chart;
      return exhaustive;
    }
  }
}

function searchTrackedCompetitors(
  organizationId: string,
  projectId: string,
  search: string
) {
  const normalized = search.toLowerCase();
  const pattern = escapeLikePattern(normalized);
  const lowerName = sql`lower(${geoCompetitors.name})`;
  return db
    .select({
      id: geoCompetitors.id,
      name: geoCompetitors.name,
      domain: geoCompetitors.domain,
      kind: geoCompetitors.kind,
    })
    .from(geoCompetitors)
    .where(
      and(
        eq(geoCompetitors.projectId, projectId),
        eq(geoCompetitors.organizationId, organizationId),
        ilike(geoCompetitors.name, `%${pattern}%`)
      )
    )
    .orderBy(
      sql`case when ${lowerName} = ${normalized} then 0 when ${lowerName} like ${`${pattern}%`} then 1 else 2 end`,
      asc(geoCompetitors.name)
    )
    .limit(GEO_CONTEXT_COMPETITOR_LIMIT);
}

function escapeLikePattern(value: string): string {
  return value.replace(LIKE_SPECIAL_CHARS_REGEX, "\\$&");
}

export async function loadGeoProjectContextForTool(
  organizationId: string,
  projectId: string,
  includeAnswers: boolean,
  competitorSearch?: string
) {
  const since = new Date(Date.now() - GEO_CONTEXT_LOOKBACK_DAYS * MS_PER_DAY);
  const mentionWhere = and(
    eq(geoMentionChecks.projectId, projectId),
    eq(geoMentionChecks.organizationId, organizationId),
    isNull(geoMentionChecks.sequenceId),
    isNull(geoMentionChecks.personaId),
    geoCheckInPromptLanguage,
    eq(geoMentionChecks.turn, 0),
    gte(geoMentionChecks.capturedAt, since)
  );
  const mentionOrderBy = [
    geoMentionChecks.promptId,
    geoMentionChecks.engine,
    desc(geoMentionChecks.capturedAt),
  ] as const;

  const [project, settings, competitors, prompts, checks] = await Promise.all([
    db.query.projects.findFirst({
      columns: { id: true, name: true, isSample: true },
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId)
      ),
    }),
    db.query.geoSettings.findFirst({
      columns: { companyName: true, aliases: true },
      where: and(
        eq(geoSettings.projectId, projectId),
        eq(geoSettings.organizationId, organizationId)
      ),
    }),
    selectGeoContextCompetitors({ organizationId, projectId }),
    db
      .select({ id: geoPrompts.id, prompt: geoPrompts.prompt })
      .from(geoPrompts)
      .where(
        and(
          eq(geoPrompts.projectId, projectId),
          eq(geoPrompts.organizationId, organizationId),
          eq(geoPrompts.enabled, true)
        )
      ),
    db
      .selectDistinctOn([geoMentionChecks.promptId, geoMentionChecks.engine], {
        ...mentionCheckBaseColumns,
        ...(includeAnswers ? { answer: geoMentionChecks.answer } : {}),
      })
      .from(geoMentionChecks)
      .where(mentionWhere)
      .orderBy(...mentionOrderBy)
      .limit(GEO_CONTEXT_MAX_CHECKS),
  ]);

  const searchedCompetitors = competitorSearch?.trim()
    ? await searchTrackedCompetitors(
        organizationId,
        projectId,
        competitorSearch.trim()
      )
    : null;

  const latestChecks = checks.map((check) => {
    const base = {
      prompt: check.prompt,
      engine: check.engine,
      mentioned: check.mentioned,
      position: check.position,
      sentiment: check.sentiment,
      competitorsMentioned: check.competitors,
      capturedAt: check.capturedAt.toISOString(),
    };
    if (
      includeAnswers &&
      "answer" in check &&
      typeof check.answer === "string"
    ) {
      return {
        ...base,
        answer: check.answer.slice(0, GEO_CONTEXT_MAX_ANSWER_CHARS),
      };
    }
    return {
      ...base,
      excerpt: check.excerpt.slice(0, GEO_CONTEXT_MAX_EXCERPT_CHARS),
    };
  });

  return {
    found: Boolean(project),
    project: project
      ? { id: project.id, name: project.name, isSample: project.isSample }
      : null,
    brand: {
      name: settings?.companyName ?? null,
      aliases: settings?.aliases ?? [],
    },
    competitors: (searchedCompetitors ?? competitors.competitors).map(
      ({ name, domain, kind }) => ({ name, domain, kind })
    ),
    trackedCompetitorCount: competitors.total,
    trackedPrompts: prompts.map((prompt) => prompt.prompt),
    latestChecks,
  };
}

/**
 * One scan's status and the tracked-prompt answers it stored, a page at a
 * time, for agents that started a prompt scan. `null` when the workspace has no
 * scan with that id.
 */
export async function loadGeoScanForTool(
  organizationId: string,
  scanId: string,
  offset = 0
) {
  const scan = await db.query.geoScans.findFirst({
    columns: {
      status: true,
      startedAt: true,
      finishedAt: true,
      errorMessage: true,
      planSummary: true,
    },
    where: and(
      eq(geoScans.id, scanId),
      eq(geoScans.organizationId, organizationId)
    ),
  });
  if (!scan) {
    return null;
  }
  // One extra row tells whether another page exists.
  const rows = await queryGeoScanAnswers(
    { organizationId, scanId },
    { limit: GEO_SCAN_RESULT_ANSWERS_LIMIT + 1, offset }
  );
  const answers = rows.slice(0, GEO_SCAN_RESULT_ANSWERS_LIMIT);
  const hasMore = rows.length > GEO_SCAN_RESULT_ANSWERS_LIMIT;
  return {
    scanId,
    status: scan.status,
    started_at: scan.startedAt.toISOString(),
    finished_at: scan.finishedAt?.toISOString() ?? null,
    error: scan.status === "failed" ? scan.errorMessage : null,
    engines: scan.planSummary?.engines ?? [],
    answers: answers.map((row) => ({
      prompt_id: row.promptId,
      prompt: row.prompt,
      engine: row.engine,
      language: row.language,
      mentioned: row.mentioned,
      position: row.position,
      competitors: row.competitors.slice(0, GEO_SCAN_RESULT_COMPETITORS_LIMIT),
      excerpt: row.excerpt.slice(0, GEO_SCAN_RESULT_EXCERPT_CHARS),
    })),
    has_more: hasMore,
    next_offset: hasMore ? offset + answers.length : null,
  };
}
