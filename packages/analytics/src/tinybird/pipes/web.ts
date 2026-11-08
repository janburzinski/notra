import {
  defineEndpoint,
  defineMaterializedView,
  node,
  p,
  t,
} from "@tinybirdco/sdk";

import {
  GEO_CAPTURED_COMPARISON_WINDOW_SQL,
  GEO_CAPTURED_CURRENT_CONDITION,
  GEO_CAPTURED_PREVIOUS_CONDITION,
  GEO_CAPTURED_WINDOW_SQL,
  GEO_DAY_COMPARISON_WINDOW_SQL,
  GEO_DAY_CURRENT_CONDITION,
  GEO_DAY_PREVIOUS_CONDITION,
  GEO_DAY_WINDOW_SQL,
  GEO_HOSTS_PARAMS,
  GEO_HOSTS_SQL,
  GEO_PATH_PARAMS,
  GEO_PATH_SQL,
  GEO_PROJECT_SCOPE_SQL,
} from "../../constants/geo-queries";
import {
  WEB_AUDIENCE_VALUE_SQL,
  WEB_IMPORTED_QUERY_PARAMS,
  WEB_IMPORTED_SESSIONS_GRAIN_SQL,
  WEB_IMPORTED_SESSIONS_SQL,
  WEB_IMPORTED_VIEWS_GRAIN_SQL,
  WEB_IMPORTED_WHERE,
  WEB_LANDING_SQL,
  WEB_OVERVIEW_COLUMNS,
  WEB_PAGES_WHERE,
  WEB_PATH_SET,
  WEB_QUERY_PARAMS,
  WEB_RAW_WHERE,
  WEB_SCOPE_SQL,
  WEB_UTM_RAW_ONLY_SQL,
  WEB_UTM_RAW_WHERE,
  WEB_UTM_ROLLUP_VALUE_SQL,
  WEB_UTM_VALUE_SQL,
} from "../../constants/web-queries";
import { sumAcrossSources } from "../../utils/union-sql";
import {
  webAudienceDaily,
  webPagesDaily,
  webSourcesDaily,
} from "../datasources";

export const webPagesDailyMv = defineMaterializedView("web_pages_daily_mv", {
  description: "Rolls web_page_views into web_pages_daily on every ingest",
  datasource: webPagesDaily,
  nodes: [
    node({
      name: "pages_daily",
      sql: `
        SELECT
          toDate(captured_at) AS day,
          organization_id,
          project_id,
          site_id,
          host,
          path,
          status,
          countState() AS views_state,
          uniqState(visitor_id) AS visitors_state,
          countIfState(toUInt8(status < 400 AND ${WEB_LANDING_SQL})) AS sessions_state,
          countIfState(toUInt8(status < 400 AND session_page_index = 2)) AS engaged_sessions_state,
          uniqIfState(visitor_id, toUInt8(referrer_group = 'ai')) AS ai_visitors_state
        FROM web_page_views
        GROUP BY day, organization_id, project_id, site_id, host, path, status
      `,
    }),
  ],
});

export const webSourcesDailyMv = defineMaterializedView(
  "web_sources_daily_mv",
  {
    description:
      "Rolls the first page of every session in web_page_views into web_sources_daily",
    datasource: webSourcesDaily,
    nodes: [
      node({
        name: "sources_daily",
        sql: `
          SELECT
            toDate(captured_at) AS day,
            organization_id,
            project_id,
            site_id,
            host,
            referrer_group,
            referrer_source,
            ai_product,
            utm_source,
            utm_medium,
            utm_campaign,
            countState() AS sessions_state,
            uniqState(visitor_id) AS visitors_state
          FROM web_page_views
          WHERE ${WEB_LANDING_SQL} AND status < 400
          GROUP BY day, organization_id, project_id, site_id, host,
            referrer_group, referrer_source, ai_product,
            utm_source, utm_medium, utm_campaign
        `,
      }),
    ],
  }
);

export const webAudienceDailyMv = defineMaterializedView(
  "web_audience_daily_mv",
  {
    description: "Rolls web_page_views into web_audience_daily on every ingest",
    datasource: webAudienceDaily,
    nodes: [
      node({
        name: "audience_daily",
        sql: `
          SELECT
            toDate(captured_at) AS day,
            organization_id,
            project_id,
            site_id,
            host,
            country,
            device,
            browser,
            os,
            countState() AS views_state,
            uniqState(visitor_id) AS visitors_state
          FROM web_page_views
          WHERE status < 400
          GROUP BY day, organization_id, project_id, site_id, host,
            country, device, browser, os
        `,
      }),
    ],
  }
);

export const webOverview = defineEndpoint("web_overview", {
  description:
    "Views, visitors, sessions and engaged sessions for the window and the window before it, including completed imports",
  params: { ...WEB_IMPORTED_QUERY_PARAMS, ...GEO_PATH_PARAMS },
  nodes: [
    node({
      name: "overview",
      sql: `
        SELECT
          countMergeIf(views_state, (${GEO_DAY_CURRENT_CONDITION})) AS views,
          countMergeIf(views_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_views,
          uniqMergeIf(visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS visitors,
          uniqMergeIf(visitors_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_visitors,
          countIfMergeIf(sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS sessions,
          countIfMergeIf(sessions_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_sessions,
          countIfMergeIf(engaged_sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS engaged_sessions,
          uniqIfMergeIf(ai_visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS ai_visitors,
          uniqIfMergeIf(ai_visitors_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_ai_visitors
        FROM web_pages_daily
        ${WEB_PAGES_WHERE}
          AND status < 400
          ${GEO_PATH_SQL}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
      `,
    }),
    node({
      name: "overview_imported",
      sql: `
        SELECT
          sumIf(i.pageviews, grain = ${WEB_IMPORTED_VIEWS_GRAIN_SQL} AND (${GEO_DAY_CURRENT_CONDITION})) AS views,
          sumIf(i.pageviews, grain = ${WEB_IMPORTED_VIEWS_GRAIN_SQL} AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_views,
          sumIf(ifNull(i.visitors, 0), grain = ${WEB_IMPORTED_VIEWS_GRAIN_SQL} AND (${GEO_DAY_CURRENT_CONDITION})) AS visitors,
          sumIf(ifNull(i.visitors, 0), grain = ${WEB_IMPORTED_VIEWS_GRAIN_SQL} AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_visitors,
          sumIf(ifNull(i.visits, 0), grain = ${WEB_IMPORTED_SESSIONS_GRAIN_SQL} AND (${GEO_DAY_CURRENT_CONDITION})) AS sessions,
          sumIf(ifNull(i.visits, 0), grain = ${WEB_IMPORTED_SESSIONS_GRAIN_SQL} AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_sessions,
          toUInt64(sumIf(ifNull(i.visits, 0) - least(ifNull(i.bounces, 0), ifNull(i.visits, 0)), grain = ${WEB_IMPORTED_SESSIONS_GRAIN_SQL} AND (${GEO_DAY_CURRENT_CONDITION}))) AS engaged_sessions,
          sumIf(ifNull(i.visitors, 0), grain = 'source' AND referrer_group = 'ai' AND (${GEO_DAY_CURRENT_CONDITION})) AS ai_visitors,
          sumIf(ifNull(i.visitors, 0), grain = 'source' AND referrer_group = 'ai' AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_ai_visitors
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          ${GEO_PATH_SQL}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
      `,
    }),
    node({
      name: "overview_total",
      sql: sumAcrossSources({
        sources: ["overview", "overview_imported"],
        keys: [],
        sums: WEB_OVERVIEW_COLUMNS,
      }),
    }),
  ],
  output: {
    views: t.uint64(),
    previous_views: t.uint64(),
    visitors: t.uint64(),
    previous_visitors: t.uint64(),
    sessions: t.uint64(),
    previous_sessions: t.uint64(),
    engaged_sessions: t.uint64(),
    ai_visitors: t.uint64(),
    previous_ai_visitors: t.uint64(),
  },
});

export const webTimeseries = defineEndpoint("web_timeseries", {
  description: "Daily human views and visitors, including completed imports",
  params: { ...WEB_IMPORTED_QUERY_PARAMS, ...GEO_PATH_PARAMS },
  nodes: [
    node({
      name: "daily_native",
      sql: `
        SELECT
          day,
          countMerge(views_state) AS views,
          uniqMerge(visitors_state) AS visitors
        FROM web_pages_daily
        ${WEB_PAGES_WHERE}
          AND status < 400
          ${GEO_PATH_SQL}
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY day
      `,
    }),
    node({
      name: "daily_imported",
      sql: `
        SELECT
          day,
          sum(i.pageviews) AS views,
          sum(ifNull(i.visitors, 0)) AS visitors
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND grain = ${WEB_IMPORTED_VIEWS_GRAIN_SQL}
          ${GEO_PATH_SQL}
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY day
      `,
    }),
    node({
      name: "daily",
      sql: sumAcrossSources({
        sources: ["daily_native", "daily_imported"],
        keys: ["day"],
        sums: ["views", "visitors"],
        tail: "ORDER BY day ASC",
      }),
    }),
  ],
  output: {
    day: t.date(),
    views: t.uint64(),
    visitors: t.uint64(),
  },
});

export const webPages = defineEndpoint("web_pages", {
  description:
    "Top pages by human views, with visitors, sessions that started there and AI-referred visitors; status 404 lists missing pages. Completed imports add their page and entry-page rows.",
  params: {
    ...WEB_IMPORTED_QUERY_PARAMS,
    ...GEO_PATH_PARAMS,
    not_found: p
      .int32()
      .optional(0)
      .describe("Set to 1 to list pages that answered 404"),
    limit: p.int32().optional(20).describe("Max rows"),
  },
  nodes: [
    node({
      name: "pages_native",
      sql: `
        SELECT
          host,
          path,
          countMergeIf(views_state, (${GEO_DAY_CURRENT_CONDITION})) AS views,
          countMergeIf(views_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_views,
          uniqMergeIf(visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS visitors,
          countIfMergeIf(sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS landings,
          uniqIfMergeIf(ai_visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS ai_visitors
        FROM web_pages_daily
        ${WEB_PAGES_WHERE}
          AND if({{Int32(not_found, 0)}} = 1, status = 404, status < 400)
          ${GEO_PATH_SQL}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY host, path
      `,
    }),
    node({
      name: "pages_imported",
      sql: `
        SELECT
          host,
          path,
          sumIf(i.pageviews, grain = 'page' AND (${GEO_DAY_CURRENT_CONDITION})) AS views,
          sumIf(i.pageviews, grain = 'page' AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_views,
          sumIf(ifNull(i.visitors, 0), grain = 'page' AND (${GEO_DAY_CURRENT_CONDITION})) AS visitors,
          sumIf(ifNull(i.entrances, 0), grain = 'entry_page' AND (${GEO_DAY_CURRENT_CONDITION})) AS landings,
          toUInt64(0) AS ai_visitors
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND {{Int32(not_found, 0)}} = 0
          AND grain IN ('page', 'entry_page')
          ${GEO_PATH_SQL}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY host, path
      `,
    }),
    node({
      name: "top_pages",
      sql: sumAcrossSources({
        sources: ["pages_native", "pages_imported"],
        keys: ["host", "path"],
        sums: [
          "views",
          "previous_views",
          "visitors",
          "landings",
          "ai_visitors",
        ],
        tail: `HAVING views > 0
        ORDER BY views DESC, host ASC, path ASC
        LIMIT {{Int32(limit, 20)}}`,
      }),
    }),
  ],
  output: {
    host: t.string(),
    path: t.string(),
    views: t.uint64(),
    previous_views: t.uint64(),
    visitors: t.uint64(),
    landings: t.uint64(),
    ai_visitors: t.uint64(),
  },
});

export const webSources = defineEndpoint("web_sources", {
  description:
    "Where sessions came from: referrer group and source (AI products included), counted on each session's first page; with a path, only sessions that landed on it. Completed imports add their source rows when no path is set.",
  params: {
    ...WEB_IMPORTED_QUERY_PARAMS,
    ...GEO_PATH_PARAMS,
    limit: p.int32().optional(20).describe("Max rows"),
  },
  nodes: [
    node({
      name: "sources_rollup",
      sql: `
        SELECT
          referrer_group,
          referrer_source,
          any(ai_product) AS ai_product,
          countMergeIf(sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS sessions,
          countMergeIf(sessions_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_sessions,
          uniqMergeIf(visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS visitors
        FROM web_sources_daily
        ${WEB_PAGES_WHERE}
          AND NOT ${WEB_PATH_SET}
          AND referrer_group != 'internal'
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY referrer_group, referrer_source
        HAVING sessions > 0
      `,
    }),
    node({
      name: "sources_path",
      sql: `
        SELECT
          referrer_group,
          referrer_source,
          any(ai_product) AS ai_product,
          countIf(${GEO_CAPTURED_CURRENT_CONDITION}) AS sessions,
          countIf(${GEO_CAPTURED_PREVIOUS_CONDITION}) AS previous_sessions,
          uniqIf(visitor_id, ${GEO_CAPTURED_CURRENT_CONDITION}) AS visitors
        FROM web_page_views
        ${WEB_RAW_WHERE}
          AND ${WEB_LANDING_SQL}
          AND status < 400
          AND referrer_group != 'internal'
          ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
        GROUP BY referrer_group, referrer_source
        HAVING sessions > 0
      `,
    }),
    node({
      name: "sources_imported",
      sql: `
        SELECT
          referrer_group,
          referrer_source,
          any(i.ai_product) AS ai_product,
          sumIf(${WEB_IMPORTED_SESSIONS_SQL}, ${GEO_DAY_CURRENT_CONDITION}) AS sessions,
          sumIf(${WEB_IMPORTED_SESSIONS_SQL}, ${GEO_DAY_PREVIOUS_CONDITION}) AS previous_sessions,
          sumIf(ifNull(i.visitors, 0), ${GEO_DAY_CURRENT_CONDITION}) AS visitors
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND NOT ${WEB_PATH_SET}
          AND grain = 'source'
          AND referrer_group != 'internal'
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY referrer_group, referrer_source
      `,
    }),
    node({
      name: "sources",
      sql: sumAcrossSources({
        sources: ["sources_rollup", "sources_path", "sources_imported"],
        keys: ["referrer_group", "referrer_source"],
        sums: ["sessions", "previous_sessions", "visitors"],
        maxes: ["ai_product"],
        tail: `HAVING sessions > 0
        ORDER BY sessions DESC, referrer_source ASC
        LIMIT {{Int32(limit, 20)}}`,
      }),
    }),
  ],
  output: {
    referrer_group: t.string(),
    referrer_source: t.string(),
    sessions: t.uint64(),
    previous_sessions: t.uint64(),
    visitors: t.uint64(),
    ai_product: t.string(),
  },
});

export const webUtm = defineEndpoint("web_utm", {
  description:
    "Sessions per UTM source, medium, campaign, term or content, counted on each session's first page, with the previous period. Term and content come from the raw page views (90 days). Completed imports add their rows when no path is set.",
  params: {
    ...WEB_IMPORTED_QUERY_PARAMS,
    ...GEO_PATH_PARAMS,
    dimension: p
      .string()
      .optional("source")
      .describe("source, medium, campaign, term or content"),
    limit: p.int32().optional(20).describe("Max rows"),
  },
  nodes: [
    node({
      name: "utm_rollup",
      sql: `
        SELECT
          ${WEB_UTM_ROLLUP_VALUE_SQL} AS value,
          countMergeIf(sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS sessions,
          countMergeIf(sessions_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_sessions,
          uniqMergeIf(visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS visitors
        FROM web_sources_daily
        ${WEB_PAGES_WHERE}
          AND NOT ${WEB_PATH_SET}
          AND NOT ${WEB_UTM_RAW_ONLY_SQL}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY value
        HAVING value != '' AND sessions > 0
      `,
    }),
    node({
      name: "utm_raw",
      sql: `
        SELECT
          ${WEB_UTM_VALUE_SQL} AS value,
          countIf(${GEO_CAPTURED_CURRENT_CONDITION}) AS sessions,
          countIf(${GEO_CAPTURED_PREVIOUS_CONDITION}) AS previous_sessions,
          uniqIf(visitor_id, ${GEO_CAPTURED_CURRENT_CONDITION}) AS visitors
        FROM web_page_views
        ${WEB_UTM_RAW_WHERE}
          AND ${WEB_LANDING_SQL}
          AND status < 400
          ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
        GROUP BY value
        HAVING value != '' AND sessions > 0
      `,
    }),
    node({
      name: "utm_imported",
      sql: `
        SELECT
          ${WEB_UTM_VALUE_SQL} AS value,
          sumIf(${WEB_IMPORTED_SESSIONS_SQL}, ${GEO_DAY_CURRENT_CONDITION}) AS sessions,
          sumIf(${WEB_IMPORTED_SESSIONS_SQL}, ${GEO_DAY_PREVIOUS_CONDITION}) AS previous_sessions,
          sumIf(ifNull(i.visitors, 0), ${GEO_DAY_CURRENT_CONDITION}) AS visitors
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND NOT ${WEB_PATH_SET}
          AND grain IN ('source', 'campaign')
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY value
        HAVING value != ''
      `,
    }),
    node({
      name: "utm",
      sql: sumAcrossSources({
        sources: ["utm_rollup", "utm_raw", "utm_imported"],
        keys: ["value"],
        sums: ["sessions", "previous_sessions", "visitors"],
        tail: `HAVING sessions > 0
        ORDER BY sessions DESC, value ASC
        LIMIT {{Int32(limit, 20)}}`,
      }),
    }),
  ],
  output: {
    value: t.string(),
    sessions: t.uint64(),
    previous_sessions: t.uint64(),
    visitors: t.uint64(),
  },
});

export const webAudience = defineEndpoint("web_audience", {
  description:
    "Visitors per country, device, browser or OS, including completed imports when no path is set",
  params: {
    ...WEB_IMPORTED_QUERY_PARAMS,
    ...GEO_PATH_PARAMS,
    dimension: p
      .string()
      .optional("country")
      .describe("country, device, browser or os"),
    limit: p.int32().optional(10).describe("Max rows"),
  },
  nodes: [
    node({
      name: "audience_rollup",
      sql: `
        SELECT
          ${WEB_AUDIENCE_VALUE_SQL} AS value,
          uniqMergeIf(visitors_state, (${GEO_DAY_CURRENT_CONDITION})) AS visitors,
          uniqMergeIf(visitors_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_visitors,
          countMergeIf(views_state, (${GEO_DAY_CURRENT_CONDITION})) AS views
        FROM web_audience_daily
        ${WEB_PAGES_WHERE}
          AND NOT ${WEB_PATH_SET}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY value
        HAVING visitors > 0
      `,
    }),
    node({
      name: "audience_path",
      sql: `
        SELECT
          ${WEB_AUDIENCE_VALUE_SQL} AS value,
          uniqIf(visitor_id, ${GEO_CAPTURED_CURRENT_CONDITION}) AS visitors,
          uniqIf(visitor_id, ${GEO_CAPTURED_PREVIOUS_CONDITION}) AS previous_visitors,
          countIf(${GEO_CAPTURED_CURRENT_CONDITION}) AS views
        FROM web_page_views
        ${WEB_RAW_WHERE}
          AND status < 400
          ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
        GROUP BY value
        HAVING visitors > 0
      `,
    }),
    node({
      name: "audience_imported",
      sql: `
        SELECT
          ${WEB_AUDIENCE_VALUE_SQL} AS value,
          sumIf(ifNull(i.visitors, 0), ${GEO_DAY_CURRENT_CONDITION}) AS visitors,
          sumIf(ifNull(i.visitors, 0), ${GEO_DAY_PREVIOUS_CONDITION}) AS previous_visitors,
          sumIf(i.pageviews, ${GEO_DAY_CURRENT_CONDITION}) AS views
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND NOT ${WEB_PATH_SET}
          AND grain = {{String(dimension, 'country')}}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
        GROUP BY value
      `,
    }),
    node({
      name: "audience",
      sql: sumAcrossSources({
        sources: ["audience_rollup", "audience_path", "audience_imported"],
        keys: ["value"],
        sums: ["visitors", "previous_visitors", "views"],
        tail: `HAVING visitors > 0 OR views > 0
        ORDER BY visitors DESC, views DESC, value ASC
        LIMIT {{Int32(limit, 10)}}`,
      }),
    }),
  ],
  output: {
    value: t.string(),
    visitors: t.uint64(),
    previous_visitors: t.uint64(),
    views: t.uint64(),
  },
});

export const webHosts = defineEndpoint("web_hosts", {
  description:
    "Hosts and sites with human views in the window, plus Sites with only AI traffic (0 views), for the domain selector; completed imports add their hosts",
  params: WEB_IMPORTED_QUERY_PARAMS,
  nodes: [
    node({
      name: "hosts_native",
      sql: `
        SELECT host, site_id, sum(views) AS views
        FROM (
          SELECT
            host,
            site_id,
            countMerge(views_state) AS views
          FROM web_pages_daily
          ${WEB_PAGES_WHERE}
            ${GEO_DAY_WINDOW_SQL}
          GROUP BY host, site_id
          UNION ALL
          SELECT host, site_id, toUInt64(0) AS views
          FROM geo_traffic_pages_by_host_daily
          ${WEB_PAGES_WHERE}
            AND site_id != ''
            ${GEO_DAY_WINDOW_SQL}
          GROUP BY host, site_id
        )
        GROUP BY host, site_id
      `,
    }),
    node({
      name: "hosts_imported",
      sql: `
        SELECT
          host,
          site_id,
          sum(i.pageviews) AS views
        FROM web_imported_daily AS i
        ${WEB_IMPORTED_WHERE}
          AND grain = 'total'
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY host, site_id
      `,
    }),
    node({
      name: "hosts",
      sql: sumAcrossSources({
        sources: ["hosts_native", "hosts_imported"],
        keys: ["host", "site_id"],
        sums: ["views"],
        tail: "ORDER BY views DESC, host ASC",
      }),
    }),
  ],
  output: {
    host: t.string(),
    site_id: t.string(),
    views: t.uint64(),
  },
});

export const webNativeFirstDay = defineEndpoint("web_native_first_day", {
  description:
    "First day with native (non-imported) human or AI traffic for a project and hosts; imports stop the day before",
  params: {
    organization_id: p.string().describe("Organization id"),
    project_id: p.string().describe("Project id"),
    ...GEO_HOSTS_PARAMS,
  },
  nodes: [
    node({
      name: "first_day",
      sql: `
        SELECT
          (
            SELECT min(day)
            FROM web_pages_daily
            WHERE organization_id = {{String(organization_id)}}
              AND project_id = {{String(project_id)}}
              ${GEO_HOSTS_SQL}
          ) AS web_first_day,
          (
            SELECT min(day)
            FROM geo_traffic_pages_by_host_daily
            WHERE organization_id = {{String(organization_id)}}
              AND project_id = {{String(project_id)}}
              ${GEO_HOSTS_SQL}
          ) AS geo_first_day
      `,
    }),
  ],
  output: {
    web_first_day: t.date(),
    geo_first_day: t.date(),
  },
});

export const webAiOutcomes = defineEndpoint("web_ai_outcomes", {
  description:
    "Pages per session and the share of sessions that read two or more pages, per AI source and for all sessions; with a path, only sessions that landed on it",
  params: { ...WEB_QUERY_PARAMS, ...GEO_PATH_PARAMS },
  nodes: [
    node({
      name: "outcome_sessions",
      sql: `
        SELECT
          session_id,
          anyIf(referrer_group, ${WEB_LANDING_SQL}) AS landing_group,
          anyIf(referrer_source, ${WEB_LANDING_SQL}) AS landing_source,
          anyIf(path, ${WEB_LANDING_SQL}) AS landing_path,
          count() AS pages
        FROM web_page_views
        WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          AND session_id != ''
          AND status < 400
          ${GEO_CAPTURED_WINDOW_SQL}
        GROUP BY session_id
        HAVING {{String(path, '')}} = '' OR landing_path = {{String(path, '')}}
      `,
    }),
    node({
      name: "outcomes",
      sql: `
        SELECT
          source,
          count() AS sessions,
          avg(pages) AS pages_per_session,
          countIf(pages >= 2) / greatest(count(), 1) AS engaged_rate
        FROM outcome_sessions
        ARRAY JOIN if(landing_group = 'ai', ['', landing_source], ['']) AS source
        GROUP BY source
        ORDER BY source = '' ASC, sessions DESC
      `,
    }),
  ],
  output: {
    source: t.string(),
    sessions: t.uint64(),
    pages_per_session: t.float64(),
    engaged_rate: t.float64(),
  },
});

export const webEngagement = defineEndpoint("web_engagement", {
  description:
    "Average visible seconds per page view, overall (empty path, with the window before) and per page",
  params: {
    ...WEB_QUERY_PARAMS,
    ...GEO_PATH_PARAMS,
    limit: p.int32().optional(50).describe("Max page rows"),
  },
  nodes: [
    node({
      name: "engagement_views",
      sql: `
        SELECT
          view_id,
          any(host) AS view_host,
          any(path) AS view_path,
          min(captured_at) AS view_at,
          max(visible_ms) AS view_ms
        FROM web_page_engagement
        WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          ${GEO_PATH_SQL}
          ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
        GROUP BY view_id
      `,
    }),
    node({
      name: "engagement",
      sql: `
        WITH viewed AS (
          SELECT
            view_host AS host,
            view_path AS path,
            view_at AS captured_at,
            view_ms AS visible_ms
          FROM engagement_views
        )
        SELECT * FROM (
          SELECT
            '' AS host,
            '' AS path,
            countIf(${GEO_CAPTURED_CURRENT_CONDITION}) AS views,
            ifNotFinite(avgIf(visible_ms, ${GEO_CAPTURED_CURRENT_CONDITION}), 0) / 1000 AS avg_seconds,
            ifNotFinite(avgIf(visible_ms, ${GEO_CAPTURED_PREVIOUS_CONDITION}), 0) / 1000 AS previous_avg_seconds
          FROM viewed
          UNION ALL
          SELECT
            host,
            path,
            count() AS views,
            avg(visible_ms) / 1000 AS avg_seconds,
            0 AS previous_avg_seconds
          FROM viewed
          WHERE ${GEO_CAPTURED_CURRENT_CONDITION}
          GROUP BY host, path
          ORDER BY views DESC
          LIMIT {{Int32(limit, 50)}}
        )
      `,
    }),
  ],
  output: {
    host: t.string(),
    path: t.string(),
    views: t.uint64(),
    avg_seconds: t.float64(),
    previous_avg_seconds: t.float64(),
  },
});
