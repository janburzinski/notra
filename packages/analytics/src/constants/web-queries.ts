import { p } from "@tinybirdco/sdk";

import {
  GEO_SITES_MODE_PARAM,
  GEO_HOSTS_PARAMS,
  GEO_HOSTS_SQL,
  GEO_PROJECT_SCOPE_PARAMS,
  GEO_PROJECT_SCOPE_SQL,
  GEO_SITE_SCOPE_SQL,
  GEO_WINDOW_PARAMS,
  IMPORTS_PARAMS,
  IMPORTS_SQL,
} from "./geo-queries";

const WEB_SCOPE_PARAMS = {
  site_id: p
    .string()
    .optional("")
    .describe("Notra Site id, empty for every site and SDK host"),
  ...GEO_SITES_MODE_PARAM,
  ...GEO_HOSTS_PARAMS,
};

export const WEB_SCOPE_SQL = `${GEO_SITE_SCOPE_SQL}
          ${GEO_HOSTS_SQL}`;

export const WEB_LANDING_SQL = "session_page_index <= 1";

export const WEB_QUERY_PARAMS = {
  organization_id: p.string().describe("Organization id"),
  ...GEO_PROJECT_SCOPE_PARAMS,
  ...WEB_SCOPE_PARAMS,
  ...GEO_WINDOW_PARAMS,
};

export const WEB_IMPORTED_QUERY_PARAMS = {
  ...WEB_QUERY_PARAMS,
  ...IMPORTS_PARAMS,
};

export const WEB_PAGES_WHERE = `WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}`;

export const WEB_IMPORTED_WHERE = `WHERE ${IMPORTS_SQL}
          ${GEO_HOSTS_SQL}`;

/** Imported views and visitors come from the total grain, or the page grain for one path. */
export const WEB_IMPORTED_VIEWS_GRAIN_SQL = `if({{String(path, '')}} = '', 'total', 'page')`;

/** Imported sessions come from the total grain, or the entry-page grain for one path. */
export const WEB_IMPORTED_SESSIONS_GRAIN_SQL = `if({{String(path, '')}} = '', 'total', 'entry_page')`;

/** Imported sessions; providers without visits (Vercel) fall back to visitors. */
export const WEB_IMPORTED_SESSIONS_SQL =
  "ifNull(i.visits, ifNull(i.visitors, 0))";

/**
 * Imported visitors in a breakdown; providers that only count sessions per
 * value (Rybbit, Cloudflare) fall back to visits so the row isn't zero.
 */
export const WEB_IMPORTED_BREAKDOWN_VISITORS_SQL =
  "ifNull(i.visitors, ifNull(i.visits, 0))";

export const WEB_OVERVIEW_COLUMNS = [
  "views",
  "previous_views",
  "visitors",
  "previous_visitors",
  "sessions",
  "previous_sessions",
  "engaged_sessions",
  "ai_visitors",
  "previous_ai_visitors",
] as const;

export const WEB_PATH_SET = `{{String(path, '')}} != ''`;

/** Raw page views for one path; empty when no path filter is set. */
export const WEB_RAW_WHERE = `WHERE ${WEB_PATH_SET}
          AND organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          AND path = {{String(path, '')}}`;

export const WEB_AUDIENCE_VALUE_SQL = `multiIf(
            {{String(dimension, 'country')}} = 'device', device,
            {{String(dimension, 'country')}} = 'browser', browser,
            {{String(dimension, 'country')}} = 'os', os,
            country
          )`;

const WEB_UTM_DIMENSION_SQL = "{{String(dimension, 'source')}}";

/** Term and content are kept in the raw page views only, not in web_sources_daily. */
export const WEB_UTM_RAW_ONLY_SQL = `${WEB_UTM_DIMENSION_SQL} IN ('term', 'content')`;

/** The requested UTM parameter of a page view or imported row. */
export const WEB_UTM_VALUE_SQL = `multiIf(
            ${WEB_UTM_DIMENSION_SQL} = 'medium', utm_medium,
            ${WEB_UTM_DIMENSION_SQL} = 'campaign', utm_campaign,
            ${WEB_UTM_DIMENSION_SQL} = 'term', utm_term,
            ${WEB_UTM_DIMENSION_SQL} = 'content', utm_content,
            utm_source
          )`;

/** The requested UTM parameter in web_sources_daily, which has no term or content. */
export const WEB_UTM_ROLLUP_VALUE_SQL = `multiIf(
            ${WEB_UTM_DIMENSION_SQL} = 'medium', utm_medium,
            ${WEB_UTM_DIMENSION_SQL} = 'campaign', utm_campaign,
            utm_source
          )`;

/**
 * Raw page views for UTM reports: for one path, or for term and content,
 * which only the raw rows keep. Empty otherwise, when the rollup answers.
 */
export const WEB_UTM_RAW_WHERE = `WHERE (${WEB_PATH_SET} OR ${WEB_UTM_RAW_ONLY_SQL})
          AND organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}
          ${WEB_SCOPE_SQL}
          AND ({{String(path, '')}} = '' OR path = {{String(path, '')}})`;
