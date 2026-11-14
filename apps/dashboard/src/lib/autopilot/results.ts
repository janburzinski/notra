import type { AutopilotPostResult } from "@notra/ai/types/autopilot-planner";
import {
  isTinybirdConfigured,
  queryGeoTrafficOverview,
  queryGeoTrafficPages,
  queryGeoTrafficPagesByPaths,
  queryWebPages,
} from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import { autopilotFindings, projects, sites } from "@notra/db/schema";
import { GEO_JOURNEY_BROWSE_CATEGORY } from "@notra/geo-core/constants/geo";
import { geoHiddenSourceParams } from "@notra/geo-core/geo/hidden-sources";
import { geoScopeParams, resolveGeoScope } from "@notra/geo-core/geo/projects";
import { toGeoVisitorType } from "@notra/geo-core/utils/ai-traffic";
import { siteEntryPagePath } from "@notra/sites-core/utils/entries";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Effect } from "effect";

import { AUTOPILOT_NEW_POST_KINDS } from "@/constants/autopilot-publish";
import {
  AUTOPILOT_RESULT_KINDS,
  AUTOPILOT_RESULTS_BACKFILLS_PER_RUN,
  AUTOPILOT_RESULTS_MAX_AGE_MS,
  AUTOPILOT_RESULTS_MAX_FINDINGS,
  AUTOPILOT_RESULTS_MIN_AGE_MS,
  AUTOPILOT_RESULTS_TRAFFIC_ROWS,
  AUTOPILOT_RESULTS_WINDOW_DAYS,
} from "@/constants/autopilot-results";
import type { AutopilotRunContext } from "@/types/autopilot";
import type { AutopilotFindingRow } from "@/types/autopilot-runtime";
import {
  type AutopilotResultPage,
  addPageVisits,
  pageTrafficPaths,
  resultPage,
} from "@/utils/autopilot-results";

import { getRepositoryOctokit } from "./github";
import { loadFindingImpacts } from "./impact";

const DAY_MS = 24 * 60 * 60 * 1000;
const MARKDOWN_FILE = /\.mdx?$/;

/**
 * Older merged posts never stored the file they added: read it from the pull
 * request once and keep it, a few per run.
 */
async function backfillFilePaths(
  ctx: AutopilotRunContext,
  findings: AutopilotFindingRow[]
) {
  const repository = ctx.repository;
  if (!repository) {
    return;
  }
  const missing = findings
    .filter(
      (finding) =>
        AUTOPILOT_NEW_POST_KINDS.includes(finding.kind) &&
        !finding.evidence.updatePage &&
        !finding.evidence.filePath &&
        finding.pullRequestNumber !== null &&
        finding.repository?.toLowerCase() ===
          `${repository.owner}/${repository.name}`.toLowerCase()
    )
    .slice(0, AUTOPILOT_RESULTS_BACKFILLS_PER_RUN);
  if (missing.length === 0) {
    return;
  }
  const octokit = await getRepositoryOctokit(ctx.organizationId, repository);
  // At most a few independent lookups, so they run together.
  await Promise.all(
    missing.map(async (finding) => {
      const { data: files } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner: repository.owner,
          repo: repository.name,
          pull_number: finding.pullRequestNumber ?? 0,
          per_page: 30,
          page: 1,
        }
      );
      const added = files.find(
        (file) => file.status !== "removed" && MARKDOWN_FILE.test(file.filename)
      );
      if (!added) {
        return;
      }
      finding.evidence = { ...finding.evidence, filePath: added.filename };
      await db
        .update(autopilotFindings)
        .set({
          evidence: sql`${autopilotFindings.evidence} || ${JSON.stringify({ filePath: added.filename })}::jsonb`,
        })
        .where(eq(autopilotFindings.id, finding.id));
    })
  );
}

/** Where traffic for the blog is recorded: its Notra Site, else the GEO project. */
async function loadTrafficScope(ctx: AutopilotRunContext) {
  if (ctx.siteId) {
    const site = await db.query.sites.findFirst({
      columns: { id: true, rootDirectory: true, mounts: true },
      where: and(
        eq(sites.id, ctx.siteId),
        eq(sites.organizationId, ctx.organizationId)
      ),
    });
    if (site) {
      return {
        site,
        params: {
          organization_id: ctx.organizationId,
          project_id: "",
          include_unassigned: 0,
          site_id: site.id,
        },
      };
    }
  }
  if (!ctx.projectId) {
    return null;
  }
  const scope = await Effect.runPromise(
    resolveGeoScope({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
    })
  );
  return { site: null, params: { ...geoScopeParams(scope), site_id: "" } };
}

interface AiTrafficRows {
  rows: {
    path: string;
    visitorType: string;
    answering: boolean;
    visits: number;
  }[];
  cutOff: boolean;
}

/**
 * AI and human visits over the window; null when the site sends no traffic at
 * all. Pages known by path are read exactly; pages known only by slug come
 * from the top pages, so a cut-off list leaves them unknown.
 */
async function loadPageVisits(
  scope: NonNullable<Awaited<ReturnType<typeof loadTrafficScope>>>,
  pages: AutopilotResultPage[]
) {
  const params = {
    ...scope.params,
    sites: "",
    hosts: "",
    host: "",
    path: "",
    page_paths: "",
    imports: "",
    days: AUTOPILOT_RESULTS_WINDOW_DAYS,
    date_from: "",
    date_to: "",
  };
  const exactPaths = [
    ...new Set(
      pages
        .filter((page) => page.match === "path")
        .flatMap((page) => pageTrafficPaths(page.value))
    ),
  ];
  const hasSlugPages = pages.some((page) => page.match === "slug");
  const aiQuery = async (pagePaths: string) => {
    const query = {
      ...params,
      ...geoHiddenSourceParams(),
      page_paths: pagePaths,
      visitor: "",
      limit: AUTOPILOT_RESULTS_TRAFFIC_ROWS,
    };
    // A long path list goes in the body.
    const response = await (pagePaths
      ? queryGeoTrafficPagesByPaths(query)
      : queryGeoTrafficPages(query));
    return response?.data ?? [];
  };
  const [exactRows, topRows, overview, humanPages] = await Promise.all([
    exactPaths.length > 0 ? aiQuery(exactPaths.join(",")) : [],
    hasSlugPages ? aiQuery("") : [],
    queryGeoTrafficOverview({
      ...params,
      ...geoHiddenSourceParams(),
      with_paths: 0,
    }),
    queryWebPages({
      ...params,
      not_found: 0,
      limit: AUTOPILOT_RESULTS_TRAFFIC_ROWS,
    }),
  ]);
  const humanRows = humanPages?.data ?? [];
  if (
    exactRows.length === 0 &&
    topRows.length === 0 &&
    humanRows.length === 0
  ) {
    return null;
  }
  const answering = new Set(
    (overview?.data ?? [])
      .filter((row) => row.category === GEO_JOURNEY_BROWSE_CATEGORY)
      .map((row) => row.source)
  );
  const toAiRows = (rows: typeof exactRows): AiTrafficRows => ({
    rows: rows.map((row) => ({
      path: row.path,
      visitorType: toGeoVisitorType(row.visitor_type),
      answering: answering.has(row.source),
      visits: Number(row.visits),
    })),
    cutOff: rows.length >= AUTOPILOT_RESULTS_TRAFFIC_ROWS,
  });
  return {
    exact: toAiRows(exactRows),
    top: toAiRows(topRows),
    human: humanRows.map((row) => ({
      path: row.path,
      views: Number(row.views),
    })),
    humanCutOff: humanRows.length >= AUTOPILOT_RESULTS_TRAFFIC_ROWS,
  };
}

/**
 * How Autopilot's merged posts and page updates did: AI crawler visits,
 * assistant fetches, AI clicks and human views over the last window, and AI
 * mentions before and after. Reads only stored analytics; no model calls.
 */
export async function loadAutopilotResults(
  ctx: AutopilotRunContext,
  now = new Date()
): Promise<AutopilotPostResult[]> {
  // Only posts in the repository Autopilot writes to now: older ones lived
  // on another site, and this one's traffic says nothing about them.
  const repository = ctx.repository;
  if (!repository) {
    return [];
  }
  const findings = await db
    .select()
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, ctx.organizationId),
        sql`lower(${autopilotFindings.repository}) = ${`${repository.owner}/${repository.name}`.toLowerCase()}`,
        eq(autopilotFindings.status, "merged"),
        inArray(autopilotFindings.kind, AUTOPILOT_RESULT_KINDS),
        gte(
          autopilotFindings.mergedAt,
          new Date(now.getTime() - AUTOPILOT_RESULTS_MAX_AGE_MS)
        ),
        lte(
          autopilotFindings.mergedAt,
          new Date(now.getTime() - AUTOPILOT_RESULTS_MIN_AGE_MS)
        )
      )
    )
    .orderBy(desc(autopilotFindings.mergedAt))
    .limit(AUTOPILOT_RESULTS_MAX_FINDINGS);
  if (findings.length === 0) {
    return [];
  }
  await backfillFilePaths(ctx, findings);
  const [scope, project] = await Promise.all([
    loadTrafficScope(ctx),
    ctx.projectId
      ? db.query.projects.findFirst({
          columns: { id: true, gscTopQueries: true, gscLastSyncedAt: true },
          where: and(
            eq(projects.id, ctx.projectId),
            eq(projects.organizationId, ctx.organizationId)
          ),
        })
      : null,
  ]);
  const pages = new Map(
    findings.flatMap((finding) => {
      const page = resultPage(finding.evidence, (filePath) =>
        scope?.site
          ? siteEntryPagePath({
              filePath,
              rootDirectory: scope.site.rootDirectory,
              mounts: scope.site.mounts,
            })
          : null
      );
      return page ? [[finding.id, page] as const] : [];
    })
  );
  const [visits, impacts] = await Promise.all([
    // Analytics down leaves traffic unknown; mentions still come from the scans.
    scope && isTinybirdConfigured() && pages.size > 0
      ? loadPageVisits(scope, [...pages.values()]).catch(() => null)
      : null,
    loadFindingImpacts(project ?? null, findings),
  ]);

  const results: AutopilotPostResult[] = [];
  for (const finding of findings) {
    const page = pages.get(finding.id);
    if (!page) {
      continue;
    }
    const ai = page.match === "path" ? visits?.exact : visits?.top;
    const counts = visits
      ? addPageVisits(page, {
          ai: ai && !ai.cutOff ? ai.rows : null,
          human: visits.human,
          humanCutOff: visits.humanCutOff,
        })
      : null;
    const impact = impacts[finding.id];
    results.push({
      title: finding.title,
      kind:
        finding.kind === "refresh" || finding.evidence.updatePage
          ? "update"
          : "post",
      topicSlug: finding.evidence.topic?.slug ?? null,
      page: page.value,
      mergedDaysAgo: Math.floor(
        (now.getTime() - (finding.mergedAt ?? now).getTime()) / DAY_MS
      ),
      aiCrawls: counts?.aiCrawls ?? null,
      aiAnswerFetches: counts?.aiAnswerFetches ?? null,
      aiClicks: counts?.aiClicks ?? null,
      humanViews: counts?.humanViews ?? null,
      answers:
        impact &&
        (impact.metric === "mentions" || impact.metric === "citations")
          ? {
              metric: impact.metric,
              before: impact.before,
              after: impact.after,
            }
          : null,
    });
  }
  return results;
}
