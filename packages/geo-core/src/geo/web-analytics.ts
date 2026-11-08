import {
  isTinybirdConfigured,
  queryWebAiOutcomes,
  queryWebAudience,
  queryWebEngagement,
  queryWebErrorsTop,
  queryWebHosts,
  queryWebOutboundLinks,
  queryWebOverview,
  queryWebLanguages,
  queryWebNativeFirstDay,
  queryWebPages,
  queryWebSources,
  queryWebUtm,
  queryWebTimeseries,
  queryWebVitals,
} from "@notra/analytics/tinybird/client";
import type {
  WebAudienceRow,
  WebEngagementRow,
  WebLanguagesRow,
  WebOverviewRow,
  WebVitalsRow,
} from "@notra/analytics/types/tinybird-endpoints";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import {
  WEB_BREAKDOWN_LIMIT,
  WEB_DEFAULT_DAYS,
  WEB_PAGES_LIMIT,
  WEB_SOURCES_LIMIT,
  WEB_VITAL_METRICS,
} from "../constants/web-analytics";
import type {
  GeoScopeInput,
  GeoTrafficSitesMode,
  GeoWindowInput,
  SiteAnalyticsInput,
  SiteAnalyticsResponse,
  WebAnalyticsBreakdown,
  WebAnalyticsExtras,
  WebAnalyticsPart,
  WebAnalyticsResponse,
  WebAnalyticsScope,
  WebAnalyticsScriptReports,
  WebAnalyticsTotals,
  WebEngagement,
  WebAnalyticsVital,
  WebTrackingStatus,
  WebVitalMetric,
  WebAnalyticsUtmRow,
  WebUtmDimension,
} from "../types/geo";
import { NATIVE_EPOCH_DAY } from "../utils/analytics-import-range";
import { webHostFilter } from "../utils/geo-project-domains";
import { loadCompletedImports } from "./analytics-imports";
import { geoQuery, geoRequiredQuery } from "./effect";
import { loadAiTraffic } from "./programs";
import { resolveGeoScope } from "./projects";
import { geoTrafficWindowParams } from "./window";

function toBreakdown(
  rows: readonly (WebAudienceRow | WebLanguagesRow)[] | undefined
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

function isVitalMetric(metric: string): metric is WebVitalMetric {
  return (WEB_VITAL_METRICS as readonly string[]).includes(metric);
}

/** Vitals of one device class ("all", "mobile" or "desktop"). */
function toVitals(
  rows: readonly WebVitalsRow[] | undefined,
  device: string
): WebAnalyticsVital[] {
  return (rows ?? []).flatMap((row) =>
    row.device === device && isVitalMetric(row.metric)
      ? [
          {
            metric: row.metric,
            p75: Number(row.p75),
            samples: Number(row.samples),
            good: Number(row.good),
            needsImprovement: Number(row.needs_improvement),
            poor: Number(row.poor),
          },
        ]
      : []
  );
}

/**
 * Outbound links, vitals, errors and languages, which only notra.js reports.
 * Best effort: a failed read leaves its table empty instead of failing the
 * page's core breakdowns.
 */
const loadScriptReports = Effect.fnUntraced(function* (
  params: Parameters<typeof queryWebVitals>[0]
) {
  const listed = { ...params, limit: WEB_SOURCES_LIMIT };
  const [outbound, vitals, errors, languages] = yield* Effect.all(
    [
      geoQuery("web outbound query failed", () =>
        queryWebOutboundLinks(listed)
      ),
      geoQuery("web vitals query failed", () => queryWebVitals(params)),
      geoQuery("web errors query failed", () => queryWebErrorsTop(listed)),
      geoQuery("web languages query failed", () =>
        queryWebLanguages({ ...listed, limit: WEB_BREAKDOWN_LIMIT })
      ),
    ],
    { concurrency: "unbounded" }
  );
  const reports: WebAnalyticsScriptReports = {
    outboundLinks: (outbound?.data ?? []).map((row) => ({
      url: row.url,
      clicks: Number(row.clicks),
      previousClicks: Number(row.previous_clicks),
      visitors: Number(row.visitors),
    })),
    vitals: toVitals(vitals?.data, "all"),
    vitalsByDevice: {
      mobile: toVitals(vitals?.data, "mobile"),
      desktop: toVitals(vitals?.data, "desktop"),
    },
    errors: (errors?.data ?? []).map((row) => ({
      message: row.message,
      source: row.source,
      events: Number(row.events),
      views: Number(row.views),
    })),
    languages: toBreakdown(languages?.data),
  };
  return reports;
});

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
  part: WebAnalyticsPart = "all",
  withScriptReports = false
) {
  const { base, params } = webQueryParams(scope, window, path, sites);
  const configured = isTinybirdConfigured();
  const query = configured && !isDemoMode() ? geoRequiredQuery : geoQuery;
  const completed = yield* loadCompletedImports(
    scope.organizationId,
    scope.projectId,
    "web",
    scope.hosts
  );
  const imports = completed.ids;
  const withImports = { ...params, imports };
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
    script,
  ] = yield* Effect.all(
    [
      read(summary, "web overview query failed", () =>
        queryWebOverview(withImports)
      ),
      read(summary, "web timeseries query failed", () =>
        queryWebTimeseries(withImports)
      ),
      read(breakdowns, "web pages query failed", () =>
        queryWebPages({ ...withImports, limit: WEB_PAGES_LIMIT })
      ),
      read(breakdowns, "web sources query failed", () =>
        queryWebSources({ ...withImports, limit: WEB_SOURCES_LIMIT })
      ),
      read(breakdowns, "web countries query failed", () =>
        queryWebAudience({
          ...withImports,
          dimension: "country",
          limit: WEB_BREAKDOWN_LIMIT,
        })
      ),
      read(breakdowns, "web devices query failed", () =>
        queryWebAudience({
          ...withImports,
          dimension: "device",
          limit: WEB_BREAKDOWN_LIMIT,
        })
      ),
      read(breakdowns, "web outcomes query failed", () =>
        queryWebAiOutcomes(params)
      ),
      read(summary, "web hosts query failed", () =>
        queryWebHosts({ ...base, hosts: "", imports })
      ),
      breakdowns && withScriptReports
        ? loadScriptReports(params)
        : Effect.succeed(undefined),
    ],
    { concurrency: "unbounded" }
  );

  const response: WebAnalyticsResponse = {
    configured,
    imported: completed.coverage,
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
    ...(script ? { script } : {}),
  };
  return response;
});

/**
 * Project analytics. The summary adds the average time on page unless it is
 * turned off; notra.js reports (outbound links, vitals, errors and languages)
 * only come with the breakdowns, and only on request.
 */
export const loadWebAnalytics = Effect.fn("web.projectAnalytics")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  host: string | undefined,
  path = "",
  sites: GeoTrafficSitesMode | undefined = undefined,
  part: WebAnalyticsPart = "all",
  {
    scriptReports = false,
    engagement: withEngagement = true,
  }: WebAnalyticsExtras = {}
) {
  const scope: WebAnalyticsScope = {
    ...(yield* resolveGeoScope(input)),
    siteId: "",
    hosts: webHostFilter(host),
  };
  const query =
    isTinybirdConfigured() && !isDemoMode() ? geoRequiredQuery : geoQuery;
  const [web, engagement] = yield* Effect.all(
    [
      loadWebAnalyticsForScope(scope, window, path, sites, part, scriptReports),
      part === "breakdowns" || !withEngagement
        ? Effect.succeed(undefined)
        : query("web engagement query failed", () =>
            queryWebEngagement({
              organization_id: scope.organizationId,
              project_id: scope.projectId ?? "",
              include_unassigned: scope.includeUnassigned ? 1 : 0,
              site_id: "",
              hosts: scope.hosts.join(","),
              sites: sites ?? "",
              path,
              limit: 0,
              ...geoTrafficWindowParams(window, WEB_DEFAULT_DAYS),
            })
          ),
    ],
    { concurrency: "unbounded" }
  );
  if (part === "breakdowns") {
    return web;
  }
  const response: WebAnalyticsResponse = withEngagement
    ? { ...web, engagement: toEngagement(engagement?.data) }
    : web;
  return response;
});

/**
 * Sessions per value of one UTM parameter in a project, counted on each
 * session's first page and compared with the previous period; completed
 * imports add theirs when no path is set.
 */
export const loadWebUtm = Effect.fn("web.utm")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  host: string | undefined,
  path: string,
  sites: GeoTrafficSitesMode | undefined,
  dimension: WebUtmDimension
) {
  const scope: WebAnalyticsScope = {
    ...(yield* resolveGeoScope(input)),
    siteId: "",
    hosts: webHostFilter(host),
  };
  const { params } = webQueryParams(scope, window, path, sites);
  const query =
    isTinybirdConfigured() && !isDemoMode() ? geoRequiredQuery : geoQuery;
  const completed = yield* loadCompletedImports(
    scope.organizationId,
    scope.projectId,
    "web",
    scope.hosts
  );
  const result = yield* query("web utm query failed", () =>
    queryWebUtm({
      ...params,
      imports: completed.ids,
      dimension,
      limit: WEB_SOURCES_LIMIT,
    })
  );
  return (result?.data ?? []).map((row): WebAnalyticsUtmRow => ({
    value: row.value,
    sessions: Number(row.sessions),
    previousSessions: Number(row.previous_sessions),
    visitors: Number(row.visitors),
  }));
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

/**
 * When the project's first native page view arrived, for the install card's
 * "Awaiting first page view" / "Receiving page views" line.
 */
export const loadWebTrackingStatus = Effect.fn("web.trackingStatus")(function* (
  input: GeoScopeInput
) {
  const { projectId } = yield* resolveGeoScope(input);
  if (!projectId) {
    return { firstDay: null } satisfies WebTrackingStatus;
  }
  const result = yield* geoQuery("web first day query failed", () =>
    queryWebNativeFirstDay({
      organization_id: input.organizationId,
      project_id: projectId,
      hosts: "",
    })
  );
  const day = result?.data[0]?.web_first_day;
  return {
    firstDay: day && day !== NATIVE_EPOCH_DAY ? day : null,
  } satisfies WebTrackingStatus;
});
