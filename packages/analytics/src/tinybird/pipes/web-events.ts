import { defineEndpoint, node, p, t } from "@tinybirdco/sdk";

import {
  GEO_CAPTURED_COMPARISON_WINDOW_SQL,
  GEO_CAPTURED_CURRENT_CONDITION,
  GEO_CAPTURED_PREVIOUS_CONDITION,
  GEO_CAPTURED_WINDOW_SQL,
  GEO_PATH_PARAMS,
  GEO_PATH_SQL,
  GEO_PROJECT_SCOPE_SQL,
} from "../../constants/geo-queries";
import { WEB_QUERY_PARAMS, WEB_SCOPE_SQL } from "../../constants/web-queries";
import { WEB_VITAL_THRESHOLDS } from "../../constants/web-vitals";

const WEB_EVENTS_WHERE = `WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          ${GEO_PATH_SQL}`;

const LIMIT_PARAMS = {
  ...WEB_QUERY_PARAMS,
  ...GEO_PATH_PARAMS,
  limit: p.int32().optional(20).describe("Max rows"),
};

export const webOutboundLinks = defineEndpoint("web_outbound_links", {
  description:
    "Clicks on links to other hosts, by destination host and path (no query), for the window and the window before it",
  params: LIMIT_PARAMS,
  nodes: [
    node({
      name: "outbound",
      sql: `
        SELECT
          JSONExtractString(props, 'url') AS url,
          countIf(${GEO_CAPTURED_CURRENT_CONDITION}) AS clicks,
          countIf(${GEO_CAPTURED_PREVIOUS_CONDITION}) AS previous_clicks,
          uniqIf(visitor_id, ${GEO_CAPTURED_CURRENT_CONDITION}) AS visitors
        FROM web_events
        ${WEB_EVENTS_WHERE}
          AND name = 'Outbound'
          ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
        GROUP BY url
        HAVING clicks > 0 AND url != ''
        ORDER BY clicks DESC, url ASC
        LIMIT {{Int32(limit, 20)}}
      `,
    }),
  ],
  output: {
    url: t.string(),
    clicks: t.uint64(),
    previous_clicks: t.uint64(),
    visitors: t.uint64(),
  },
});

const WEB_VITAL_TUPLES_SQL = Object.entries(WEB_VITAL_THRESHOLDS)
  .map(
    ([metric, [good, poor]]) =>
      `tuple('${metric}', ${metric}, ${good}, ${poor})`
  )
  .join(",\n          ");

export const webVitals = defineEndpoint("web_vitals", {
  description:
    "75th percentile of LCP, FCP, TTFB, INP (ms) and CLS (x1000) over page views in the window, with how many views were good, needed improvement or poor by Google's thresholds; one row per metric for all devices ('all') and per device class ('mobile' includes tablets, 'desktop'). Each view counts once with its largest reported value",
  params: { ...WEB_QUERY_PARAMS, ...GEO_PATH_PARAMS },
  nodes: [
    node({
      name: "vitals_views",
      sql: `
        SELECT
          view_id,
          max(lcp_ms) AS lcp,
          max(fcp_ms) AS fcp,
          max(ttfb_ms) AS ttfb,
          max(inp_ms) AS inp,
          max(cls_milli) AS cls
        FROM web_page_engagement
        ${WEB_EVENTS_WHERE}
          ${GEO_CAPTURED_WINDOW_SQL}
        GROUP BY view_id
      `,
    }),
    node({
      name: "vitals_devices",
      sql: `
        SELECT
          view_id,
          if(any(device) = 'desktop', 'desktop', 'mobile') AS device_class
        FROM web_page_views
        ${WEB_EVENTS_WHERE}
          AND view_id != ''
          AND device IN ('desktop', 'mobile', 'tablet')
          ${GEO_CAPTURED_WINDOW_SQL}
        GROUP BY view_id
      `,
    }),
    node({
      name: "vitals_samples",
      sql: `
        SELECT
          tupleElement(vital, 1) AS metric,
          segment AS device,
          assumeNotNull(tupleElement(vital, 2)) AS value,
          tupleElement(vital, 3) AS good_max,
          tupleElement(vital, 4) AS poor_above
        FROM (
          SELECT v.*, d.device_class
          FROM vitals_views AS v
          LEFT JOIN vitals_devices AS d USING view_id
        )
        ARRAY JOIN [
          ${WEB_VITAL_TUPLES_SQL}
        ] AS vital
        ARRAY JOIN arrayFilter(
          segment -> segment != '',
          ['all', device_class]
        ) AS segment
        WHERE tupleElement(vital, 2) IS NOT NULL
      `,
    }),
    node({
      name: "vitals",
      sql: `
        SELECT
          metric,
          device,
          quantile(0.75)(value) AS p75,
          count() AS samples,
          countIf(value <= good_max) AS good,
          countIf(value > good_max AND value <= poor_above) AS needs_improvement,
          countIf(value > poor_above) AS poor
        FROM vitals_samples
        GROUP BY metric, device
      `,
    }),
  ],
  output: {
    metric: t.string(),
    device: t.string(),
    p75: t.float64(),
    samples: t.uint64(),
    good: t.uint64(),
    needs_improvement: t.uint64(),
    poor: t.uint64(),
  },
});

export const webLanguages = defineEndpoint("web_languages", {
  description:
    "Visitors per browser language for the window and the window before it",
  params: LIMIT_PARAMS,
  nodes: [
    node({
      name: "languages",
      sql: `
          SELECT
            language AS value,
            uniqIf(visitor_id, ${GEO_CAPTURED_CURRENT_CONDITION}) AS visitors,
            uniqIf(visitor_id, ${GEO_CAPTURED_PREVIOUS_CONDITION}) AS previous_visitors
          FROM web_page_views
          ${WEB_EVENTS_WHERE}
            AND status < 400
            ${GEO_CAPTURED_COMPARISON_WINDOW_SQL}
          GROUP BY value
          HAVING value != '' AND visitors > 0
          ORDER BY visitors DESC, value ASC
          LIMIT {{Int32(limit, 20)}}
        `,
    }),
  ],
  output: {
    value: t.string(),
    visitors: t.uint64(),
    previous_visitors: t.uint64(),
  },
});

export const webErrorsTop = defineEndpoint("web_errors_top", {
  description:
    "Most frequent JavaScript errors reported by notra.plus.js in the window, by scrubbed message",
  params: LIMIT_PARAMS,
  nodes: [
    node({
      name: "errors",
      sql: `
        SELECT
          message,
          any(source) AS source,
          count() AS events,
          uniq(view_id) AS views
        FROM web_errors
        ${WEB_EVENTS_WHERE}
          ${GEO_CAPTURED_WINDOW_SQL}
        GROUP BY message
        ORDER BY events DESC, message ASC
        LIMIT {{Int32(limit, 20)}}
      `,
    }),
  ],
  output: {
    message: t.string(),
    source: t.string(),
    events: t.uint64(),
    views: t.uint64(),
  },
});
