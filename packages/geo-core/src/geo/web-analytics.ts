import {
  isTinybirdConfigured,
  queryWebAiOutcomes,
  queryWebAudience,
  queryWebEngagement,
  queryWebHosts,
  queryWebOverview,
  queryWebPages,
  queryWebSources,
  queryWebTimeseries,
} from "@notra/analytics/tinybird/client";
import type {
  WebAudienceRow,
  WebEngagementRow,
  WebOverviewRow,
} from "@notra/analytics/types/tinybird-endpoints";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import {
  WEB_BREAKDOWN_LIMIT,
  WEB_DEFAULT_DAYS,
  WEB_PAGES_LIMIT,
  WEB_SOURCES_LIMIT,
} from "../constants/web-analytics";
import type {
  GeoScopeInput,
  GeoTrafficSitesMode,
  GeoWindowInput,
  SiteAnalyticsInput,
  SiteAnalyticsResponse,
  WebAnalyticsBreakdown,
  WebAnalyticsPart,
  WebAnalyticsResponse,
  WebAnalyticsScope,
  WebAnalyticsTotals,
  WebEngagement,
} from "../types/geo";
import { webHostFilter } from "../utils/geo-project-domains";
import { geoQuery, geoRequiredQuery } from "./effect";
import { loadAiTraffic } from "./programs";
import { resolveGeoScope } from "./projects";
import { geoTrafficWindowParams } from "./window";

function toBreakdown(
  rows: readonly WebAudienceRow[] | undefined
): WebAnalyticsBreakdown[] {
  return (rows ?? []).map((row) => ({
    value: row.value,
    visitors: Number(row.visitors),
    previousVisitors:
      row.previous_visitors == null ? null : Number(row.previous_visitors),
  }));
}

function toEngagement(
  rows: readonly WebEngagementRow[] | undefined
): WebEngagement {
  const overall = rows?.find((row) => row.path === "");
  return {
    views: Number(overall?.views ?? 0),
    avgSeconds: Number(overall?.avg_seconds ?? 0),
    previousAvgSeconds: Number(overall?.previous_avg_seconds ?? 0),
    pages: (rows ?? [])
      .filter((row) => row.path !== "")
      .map((row) => ({
        host: row.host,
        path: row.path,
        views: Number(row.views),
        avgSeconds: Number(row.avg_seconds),
      })),
  };
}

function toWebTotals(row: WebOverviewRow | undefined): WebAnalyticsTotals {
  return {
    views: Number(row?.views ?? 0),
    previousViews: Number(row?.previous_views ?? 0),
    visitors: Number(row?.visitors ?? 0),
    previousVisitors: Number(row?.previous_visitors ?? 0),
    sessions: Number(row?.sessions ?? 0),
    previousSessions: Number(row?.previous_sessions ?? 0),
    engagedSessions: Number(row?.engaged_sessions ?? 0),
    aiVisitors: Number(row?.ai_visitors ?? 0),
    previousAiVisitors: Number(row?.previous_ai_visitors ?? 0),
  };
}

function webQueryParams(
  scope: WebAnalyticsScope,
  window: GeoWindowInput,
  path: string,
  sites: GeoTrafficSitesMode | undefined
) {
  const base = {
    organization_id: scope.organizationId,
    project_id: scope.projectId ?? "",
    include_unassigned: scope.includeUnassigned ? 1 : 0,
    site_id: scope.siteId,
    ...geoTrafficWindowParams(window, WEB_DEFAULT_DAYS),
  };
  const params = {
    ...base,
    hosts: scope.hosts.join(","),
    path,
    sites: sites ?? "",
  };
  return { base, params };
}

function siteWebScope(site: SiteAnalyticsInput): WebAnalyticsScope {
  return {
    organizationId: site.organizationId,
    projectId: null,
    includeUnassigned: false,
    siteId: site.id,
    hosts: [],
  };
}

const loadWebAnalyticsForScope = Effect.fn("web.analytics")(function* (
  scope: WebAnalyticsScope,
  window: GeoWindowInput,
  path: string,
  sites: GeoTrafficSitesMode | undefined = undefined,
  part: WebAnalyticsPart = "all"
) {
  const { base, params } = webQueryParams(scope, window, path, sites);
  const configured = isTinybirdConfigured();
  const query = configured && !isDemoMode() ? geoRequiredQuery : geoQuery;
  const summary = part !== "breakdowns";
  const breakdowns = part !== "summary";
  const read = <A>(enabled: boolean, label: string, run: () => Promise<A>) =>
    enabled ? query(label, run) : Effect.succeed(null);

  const [
    overview,
    timeseries,
    pages,
    sources,
    countries,
    devices,
    outcomes,
    hosts,
  ] = yield* Effect.all(
    [
      read(summary, "web overview query failed", () =>
        queryWebOverview(params)
      ),
      read(summary, "web timeseries query failed", () =>
        queryWebTimeseries(params)
      ),
      read(breakdowns, "web pages query failed", () =>
        queryWebPages({ ...params, limit: WEB_PAGES_LIMIT })
      ),
      read(breakdowns, "web sources query failed", () =>
        queryWebSources({ ...params, limit: WEB_SOURCES_LIMIT })
      ),
      read(breakdowns, "web countries query failed", () =>
        queryWebAudience({
          ...params,
          dimension: "country",
          limit: WEB_BREAKDOWN_LIMIT,
        })
      ),
      read(breakdowns, "web devices query failed", () =>
        queryWebAudience({
          ...params,
          dimension: "device",
          limit: WEB_BREAKDOWN_LIMIT,
        })
      ),
      read(breakdowns, "web outcomes query failed", () =>
        queryWebAiOutcomes(params)
      ),
      read(summary, "web hosts query failed", () =>
        queryWebHosts({ ...base, hosts: "" })
      ),
    ],
    { concurrency: "unbounded" }
  );

  const response: WebAnalyticsResponse = {
    configured,
    hosts: (hosts?.data ?? []).map((row) => ({
      host: row.host,
      siteId: row.site_id,
      views: Number(row.views),
    })),
    totals: toWebTotals(overview?.data[0]),
    points: (timeseries?.data ?? []).map((row) => ({
      day: row.day,
      views: Number(row.views),
      visitors: Number(row.visitors),
    })),
    pages: (pages?.data ?? []).map((row) => ({
      host: row.host,
      path: row.path,
      views: Number(row.views),
      previousViews: Number(row.previous_views),
      visitors: Number(row.visitors),
      landings: Number(row.landings),
      aiVisitors: Number(row.ai_visitors),
    })),
    sources: (sources?.data ?? []).map((row) => ({
      group: row.referrer_group,
      source: row.referrer_source,
      aiProduct: row.ai_product,
      sessions: Number(row.sessions),
      previousSessions: Number(row.previous_sessions),
      visitors: Number(row.visitors),
    })),
    countries: toBreakdown(countries?.data),
    devices: toBreakdown(devices?.data),
    outcomes: (outcomes?.data ?? []).map((row) => ({
      source: row.source,
      sessions: Number(row.sessions),
      pagesPerSession: Number(row.pages_per_session),
      engagedRate: Number(row.engaged_rate),
    })),
  };
  return response;
});

export const loadWebAnalytics = Effect.fn("web.projectAnalytics")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  host: string | undefined,
  path = "",
  sites: GeoTrafficSitesMode | undefined = undefined,
  part: WebAnalyticsPart = "all"
) {
  const scope = yield* resolveGeoScope(input);
  return yield* loadWebAnalyticsForScope(
    { ...scope, siteId: "", hosts: webHostFilter(host) },
    window,
    path,
    sites,
    part
  );
});

export const loadSiteAnalytics = Effect.fn("web.siteAnalytics")(function* (
  site: SiteAnalyticsInput,
  window: GeoWindowInput,
  path = ""
) {
  const scope = siteWebScope(site);
  const query =
    isTinybirdConfigured() && !isDemoMode() ? geoRequiredQuery : geoQuery;
  const [web, traffic, engagement] = yield* Effect.all(
    [
      loadWebAnalyticsForScope(scope, window, path),
      loadAiTraffic(
        {
          organizationId: site.organizationId,
          ...(site.projectId ? { projectId: site.projectId } : {}),
        },
        window,
        [],
        site.id,
        path
      ),
      query("web engagement query failed", () =>
        queryWebEngagement({
          organization_id: site.organizationId,
          project_id: "",
          include_unassigned: 0,
          site_id: site.id,
          hosts: "",
          path,
          limit: WEB_PAGES_LIMIT,
          ...geoTrafficWindowParams(window, WEB_DEFAULT_DAYS),
        })
      ),
    ],
    { concurrency: "unbounded" }
  );
  const response: SiteAnalyticsResponse = {
    web,
    traffic,
    engagement: toEngagement(engagement?.data),
  };
  return response;
});

/**
 * A site's visitor totals alone, for lists that show one number per site.
 * Uses the same overview parameters as `loadSiteAnalytics`, so both read the
 * same cached result.
 */
export const loadSiteVisitorTotals = Effect.fn("web.siteVisitorTotals")(
  function* (site: SiteAnalyticsInput, window: GeoWindowInput) {
    const { params } = webQueryParams(
      siteWebScope(site),
      window,
      "",
      undefined
    );
    const query =
      isTinybirdConfigured() && !isDemoMode() ? geoRequiredQuery : geoQuery;
    const overview = yield* query("web overview query failed", () =>
      queryWebOverview(params)
    );
    return toWebTotals(overview?.data[0]);
  }
);
