import { defineEndpoint, node, p, t } from "@tinybirdco/sdk";

import {
  GEO_EXCLUDED_SOURCES_PARAMS,
  GEO_EXCLUDED_SOURCES_SQL,
} from "../../constants/geo-queries";

/**
 * Cross-organization AI traffic for the Notra admin console. Unlike the
 * `geo_traffic_*` endpoints these are not scoped to one organization; the
 * console calls them through the dashboard's internal route with an admin
 * secret.
 */
const TRENDS_PARAMS = {
  date_from: p.string().describe("Inclusive first day (YYYY-MM-DD)"),
  date_to: p.string().describe("Exclusive last day (YYYY-MM-DD)"),
  excluded_project_ids: p
    .string()
    .optional("")
    .describe("Comma-separated project ids to leave out, empty for none"),
  ...GEO_EXCLUDED_SOURCES_PARAMS,
};

const TRENDS_SCOPE_SQL = `
          day >= toDateOrNull({{String(date_from, '')}})
          AND day < toDateOrNull({{String(date_to, '')}})
          AND visitor_type IN ('crawler', 'ai_referral')
          AND (
            {{String(excluded_project_ids, '')}} = ''
            OR NOT has(splitByChar(',', {{String(excluded_project_ids, '')}}), project_id)
          )
          ${GEO_EXCLUDED_SOURCES_SQL}`;

/** Partition of one bot's or assistant's sites on one day. */
const SITE_WINDOW = "OVER (PARTITION BY day, visitor_type, source)";

export const geoTrafficTrendsDaily = defineEndpoint(
  "geo_traffic_trends_daily",
  {
    description:
      "Daily AI crawler and referral visits per source across all organizations, with the median project's visits. Rows with an empty source count the projects that received any AI traffic that day.",
    params: {
      ...TRENDS_PARAMS,
      site_cap_factor: p
        .float64()
        .optional(0)
        .describe(
          "Cap each site at this many times the median site's visits and at the other sites' total; 0 keeps raw counts"
        ),
    },
    nodes: [
      node({
        name: "per_project",
        sql: `
        SELECT
          day,
          visitor_type,
          source,
          project_id,
          anyMerge(category_state) AS project_category,
          countMerge(visits_state) AS project_visits,
          countIfMerge(markdown_visits_state) AS project_markdown_visits
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
        GROUP BY day, visitor_type, source, project_id
      `,
      }),
      // With a positive site_cap_factor, a site counts with at most that many
      // times the median site's visits, then at most as much as all other
      // sites together, so no single site sets or dominates a published
      // figure. 0 keeps raw counts (the admin console).
      node({
        name: "site_bounds",
        sql: `
        SELECT
          *,
          if(
            {{Float64(site_cap_factor, 0)}} > 0,
            least(
              toFloat64(project_visits),
              {{Float64(site_cap_factor, 0)}} * toFloat64(quantileExact(0.5)(project_visits) ${SITE_WINDOW})
            ),
            toFloat64(project_visits)
          ) AS bounded_visits
        FROM per_project
      `,
      }),
      node({
        name: "site_capped",
        sql: `
        SELECT
          *,
          if(
            {{Float64(site_cap_factor, 0)}} > 0,
            least(bounded_visits, sum(bounded_visits) ${SITE_WINDOW} - bounded_visits),
            bounded_visits
          ) AS capped_visits
        FROM site_bounds
      `,
      }),
      // The median is over raw visits. Per-project columns are prefixed so
      // the sums' aliases don't shadow them.
      node({
        name: "per_source",
        sql: `
        SELECT
          day,
          visitor_type,
          source,
          any(project_category) AS category,
          toUInt64(round(sum(capped_visits))) AS visits,
          toUInt64(round(sum(
            if(project_visits = 0, 0, project_markdown_visits * capped_visits / project_visits)
          ))) AS markdown_visits,
          count() AS projects,
          toFloat64(quantileExact(0.5)(project_visits)) AS median_visits
        FROM site_capped
        GROUP BY day, visitor_type, source
      `,
      }),
      // Empty labels are added in `result`: an alias named like a column
      // would shadow it in this node's WHERE.
      node({
        name: "per_day",
        sql: `
        SELECT
          day,
          countMerge(visits_state) AS visits,
          countIfMerge(markdown_visits_state) AS markdown_visits,
          uniqExact(project_id) AS projects
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
        GROUP BY day
      `,
      }),
      node({
        name: "result",
        sql: `
        SELECT * FROM (
          SELECT * FROM per_source
          UNION ALL
          SELECT
            day,
            '' AS visitor_type,
            '' AS source,
            '' AS category,
            visits,
            markdown_visits,
            projects,
            0 AS median_visits
          FROM per_day
        )
        ORDER BY day ASC, visitor_type ASC, source ASC
      `,
      }),
    ],
    output: {
      day: t.date(),
      visitor_type: t.string(),
      source: t.string(),
      category: t.string(),
      visits: t.uint64(),
      markdown_visits: t.uint64(),
      projects: t.uint64(),
      median_visits: t.float64(),
    },
  }
);

export const geoTrafficTrendsProjects = defineEndpoint(
  "geo_traffic_trends_projects",
  {
    description:
      "AI crawler and referral visits per project, source and week: week 0 starts at recent_from, weeks 1 and up count back from it to baseline_from. Lists every project with AI traffic in the window, so callers can also exclude projects from geo_traffic_trends_daily.",
    params: {
      ...TRENDS_PARAMS,
      baseline_from: p
        .string()
        .describe("First day (YYYY-MM-DD) of the baseline period"),
      recent_from: p
        .string()
        .describe("First day (YYYY-MM-DD) of the recent period"),
    },
    nodes: [
      node({
        name: "project_sources",
        sql: `
        SELECT
          project_id,
          visitor_type,
          source,
          toUInt32(greatest(
            0,
            intDiv(dateDiff('day', day, toDateOrNull({{String(recent_from, '')}})) + 6, 7)
          )) AS weeks_ago,
          countMerge(visits_state) AS visits,
          countIfMerge(markdown_visits_state) AS markdown_visits
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
          AND day >= toDateOrNull({{String(baseline_from, '')}})
        GROUP BY project_id, visitor_type, source, weeks_ago
        ORDER BY project_id ASC, visitor_type ASC, source ASC, weeks_ago ASC
      `,
      }),
    ],
    output: {
      project_id: t.string(),
      visitor_type: t.string(),
      source: t.string(),
      weeks_ago: t.uint32(),
      visits: t.uint64(),
      markdown_visits: t.uint64(),
    },
  }
);
