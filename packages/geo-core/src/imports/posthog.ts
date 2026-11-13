import {
  POSTHOG_API_URLS,
  POSTHOG_CONCURRENCY,
  POSTHOG_DIRECT_REFERRER,
  POSTHOG_HOST_LOOKBACK_DAYS,
  POSTHOG_HOSTS_PER_PROJECT,
  POSTHOG_LOCAL_HOST_PATTERN,
  POSTHOG_MAX_PROJECTS,
  POSTHOG_MAX_ROWS,
  POSTHOG_ORGANIZATIONS_LIMIT,
  POSTHOG_QUERY_NAME,
  POSTHOG_REF_SEPARATOR,
  POSTHOG_REGIONS,
  POSTHOG_RESULT_LIMIT,
} from "../constants/analytics-imports";
import {
  ImportAuthError,
  ImportProviderError,
} from "../schemas/analytics-import-errors";
import {
  posthogOrganizationsResponseSchema,
  posthogQueryResponseSchema,
} from "../schemas/analytics-imports";
import type {
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  PostHogBreakdown,
  PostHogCredentials,
  PostHogRegion,
  PostHogSourceRef,
  WebImportRecord,
} from "../types/analytics-imports";
import { addDays } from "../utils/analytics-import-range";
import { importRequest } from "./http";

const PROVIDER = "posthog";
const PROJECT_ID_PATTERN = /^\d+$/;
const HOST_PATTERN = /^[a-z0-9.-]+(?::\d+)?$/;
const LEADING_WWW_PATTERN = /^www\./;
/** Notra stores UTC days; HogQL would otherwise use the project's zone. */
const DAY_SQL = "toDate(toTimeZone(timestamp, 'UTC'))";

/**
 * Breakdowns per day. Event breakdowns count page views and unique people
 * per value. Session breakdowns read the session's entry values, so they
 * also count visits, bounces and duration, the way PostHog's own web
 * analytics does.
 */
const POSTHOG_BREAKDOWNS: readonly PostHogBreakdown[] = [
  {
    grain: "page",
    requires: "all",
    scope: "events",
    dimensions: [{ expression: "properties.$pathname", field: "path" }],
  },
  {
    grain: "country",
    requires: "all",
    scope: "events",
    dimensions: [
      { expression: "properties.$geoip_country_code", field: "country" },
    ],
  },
  {
    grain: "device",
    requires: "all",
    scope: "events",
    dimensions: [{ expression: "properties.$device_type", field: "device" }],
  },
  {
    grain: "browser",
    requires: "all",
    scope: "events",
    dimensions: [{ expression: "properties.$browser", field: "browser" }],
  },
  {
    grain: "os",
    requires: "all",
    scope: "events",
    dimensions: [{ expression: "properties.$os", field: "os" }],
  },
  {
    grain: "entry_page",
    requires: "all",
    scope: "sessions",
    dimensions: [{ expression: "session.$entry_pathname", field: "path" }],
  },
  {
    grain: "source",
    requires: "none",
    scope: "sessions",
    dimensions: [
      { expression: "session.$entry_referring_domain", field: "referrer" },
      { expression: "session.$entry_utm_source", field: "utmSource" },
    ],
  },
  {
    grain: "campaign",
    requires: "any",
    scope: "sessions",
    dimensions: [
      { expression: "session.$entry_utm_source", field: "utmSource" },
      { expression: "session.$entry_utm_medium", field: "utmMedium" },
      { expression: "session.$entry_utm_campaign", field: "utmCampaign" },
    ],
  },
];

const TOTALS: PostHogBreakdown = {
  grain: "total",
  requires: "none",
  scope: "sessions",
  dimensions: [],
};

function apiUrl(credentials: PostHogCredentials, path: string): string {
  return `${POSTHOG_API_URLS[credentials.region ?? "us"]}${path}`;
}

function headers(credentials: PostHogCredentials) {
  return {
    Authorization: `Bearer ${credentials.apiKey}`,
    "content-type": "application/json",
  };
}

/** A HogQL string literal; hosts and days are also checked before this. */
function literal(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

/** A host as the import reads it: lowercased, checked, without `www.`. */
function bareHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (!HOST_PATTERN.test(normalized)) {
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: `"${host}" is not a hostname`,
    });
  }
  return normalized.replace(LEADING_WWW_PATTERN, "");
}

function toPostHogSourceRef(projectId: number | string, host: string) {
  return host
    ? `${projectId}${POSTHOG_REF_SEPARATOR}${bareHost(host)}`
    : String(projectId);
}

/**
 * The ref an import is stored and compared under: the project and the host
 * it reads, without `www.`. A source listed without a host takes the domain
 * entered for it, so one host always has one ref, whatever its spelling.
 */
export function canonicalPostHogSourceRef(ref: string, host: string): string {
  const parsed = parsePostHogSourceRef(ref);
  return toPostHogSourceRef(parsed.projectId, parsed.host ?? host);
}

export function parsePostHogSourceRef(ref: string): PostHogSourceRef {
  const index = ref.indexOf(POSTHOG_REF_SEPARATOR);
  const projectId = index === -1 ? ref : ref.slice(0, index);
  const host = index === -1 ? null : ref.slice(index + 1);
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: "unknown project",
    });
  }
  return { projectId, host: host || null };
}

/** The host and its www twin, which PostHog records as is. */
function hostVariants(host: string): string[] {
  const bare = bareHost(host);
  return [bare, `www.${bare}`];
}

function hostCondition(host: string | null): string {
  return host
    ? `AND properties.$host IN (${hostVariants(host).map(literal).join(", ")})`
    : "";
}

function count(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

/**
 * Runs one HogQL query against a project. Date functions run in UTC
 * whatever the project's zone, and the query is named so it can be told
 * apart in PostHog's query log.
 */
async function query(
  credentials: PostHogCredentials,
  projectId: string,
  sql: string,
  fetchImpl?: ImportFetch
): Promise<unknown[][]> {
  const response = await importRequest(
    PROVIDER,
    apiUrl(credentials, `/api/projects/${projectId}/query/`),
    {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: sql,
          name: POSTHOG_QUERY_NAME,
          modifiers: { convertToProjectTimezone: false },
        },
        refresh: "blocking",
      }),
    },
    posthogQueryResponseSchema,
    fetchImpl
  );
  return response.results;
}

async function organizations(
  credentials: PostHogCredentials,
  fetchImpl?: ImportFetch
) {
  const { results } = await importRequest(
    PROVIDER,
    apiUrl(
      credentials,
      `/api/organizations/?limit=${POSTHOG_ORGANIZATIONS_LIMIT}`
    ),
    { headers: headers(credentials) },
    posthogOrganizationsResponseSchema,
    fetchImpl
  );
  return results;
}

/**
 * Finds the region the key belongs to. A key is only known to the region
 * it was made in and every other region answers 401; a 403 means the right
 * region but a missing scope, so it stops the search.
 */
export async function resolvePostHogCredentials(
  credentials: PostHogCredentials,
  fetchImpl?: ImportFetch
): Promise<PostHogCredentials & { region: PostHogRegion }> {
  if (credentials.region) {
    return { ...credentials, region: credentials.region };
  }
  let firstError: unknown;
  for (const region of POSTHOG_REGIONS) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- the next region is only tried when this one doesn't know the key
      await organizations({ ...credentials, region }, fetchImpl);
      return { ...credentials, region };
    } catch (error) {
      firstError ??= error;
      if (!(error instanceof ImportAuthError && error.status === 401)) {
        throw error;
      }
    }
  }
  throw firstError;
}

async function inBatches<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < tasks.length; index += concurrency) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounded concurrency against one project's query slots
    results.push(
      ...(await Promise.all(
        tasks.slice(index, index + concurrency).map((task) => task())
      ))
    );
  }
  return results;
}

/** Hosts with page views in the last month, busiest first, local ones left out. */
async function recentHosts(
  credentials: PostHogCredentials,
  projectId: string,
  fetchImpl?: ImportFetch
): Promise<string[]> {
  const rows = await query(
    credentials,
    projectId,
    `SELECT properties.$host AS host, count() AS pageviews
FROM events
WHERE event = '$pageview'
  AND timestamp >= now() - INTERVAL ${POSTHOG_HOST_LOOKBACK_DAYS} DAY
  AND properties.$host != ''
GROUP BY host
ORDER BY pageviews DESC
LIMIT ${POSTHOG_HOSTS_PER_PROJECT * 4}`,
    fetchImpl
  );
  // An import reads a host and its www twin together, so only the busier
  // spelling of the two is listed.
  const hosts = new Map<string, string>();
  for (const [host] of rows) {
    const value = text(host).toLowerCase();
    const bare = value.replace(LEADING_WWW_PATTERN, "");
    if (
      value &&
      HOST_PATTERN.test(value) &&
      !POSTHOG_LOCAL_HOST_PATTERN.test(value) &&
      !hosts.has(bare)
    ) {
      hosts.set(bare, value);
    }
  }
  return [...hosts.values()].slice(0, POSTHOG_HOSTS_PER_PROJECT);
}

/**
 * One source per project and host it recently tracked, since a project
 * often holds a marketing site and an app. A project without recent page
 * views, or past the first few, is listed once without a host, for the
 * host to be typed in.
 */
export async function listPostHogSources(
  credentials: PostHogCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  const orgs = await organizations(credentials, fetchImpl);
  const projects = orgs.flatMap((org) =>
    org.teams
      .filter((team) => !team.is_demo)
      .map((team) => ({
        id: String(team.id),
        name: team.name || `Project ${team.id}`,
        organization: org.name ?? "",
      }))
  );
  const multipleOrganizations = orgs.length > 1;
  // Each lookup is a query, so only the first projects get host
  // suggestions; the rest are listed for their domain to be typed in.
  const hostsPerProject = await inBatches(
    projects
      .slice(0, POSTHOG_MAX_PROJECTS)
      .map((project) => () => recentHosts(credentials, project.id, fetchImpl)),
    POSTHOG_CONCURRENCY
  );
  return projects.flatMap((project, index) => {
    const name =
      multipleOrganizations && project.organization
        ? `${project.organization} / ${project.name}`
        : project.name;
    const hosts = hostsPerProject[index] ?? [];
    const source = (host: string): ImportSource => ({
      ref: toPostHogSourceRef(project.id, host),
      label: host ? `${name} · ${host}` : name,
      host,
      provider: PROVIDER,
      kind: "web",
    });
    return hosts.length > 0 ? hosts.map(source) : [source("")];
  });
}

/**
 * Page views per day in one query, so the import estimate is exact even
 * when tracking started mid-month. `ref` is canonical, so it names the
 * same host the import reads.
 */
export async function previewPostHogSource(
  credentials: PostHogCredentials,
  ref: string,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const { projectId, host } = parsePostHogSourceRef(ref);
  const rows = await query(
    credentials,
    projectId,
    `SELECT ${DAY_SQL} AS day, count() AS pageviews
FROM events
WHERE event = '$pageview'
  ${hostCondition(host)}
GROUP BY day
ORDER BY day
LIMIT ${POSTHOG_MAX_ROWS}`,
    fetchImpl
  );
  let earliestDay: string | null = null;
  let pageviews = 0;
  const pageviewsByDay: Record<string, number> = {};
  for (const [day, dayPageviews] of rows) {
    const views = count(dayPageviews);
    const key = text(day).slice(0, 10);
    pageviews += views;
    pageviewsByDay[key] = views;
    if (!earliestDay && views > 0) {
      earliestDay = key;
    }
  }
  return { earliestDay, pageviews, pageviewsByMonth: pageviewsByDay };
}

function rangeCondition(range: ImportDayRange): string {
  return `timestamp >= toDateTime(${literal(`${range.start} 00:00:00`)}, 'UTC')
  AND timestamp < toDateTime(${literal(`${addDays(range.end, 1)} 00:00:00`)}, 'UTC')`;
}

/** The HogQL for one breakdown over a chunk; columns are day, values, then counts. */
function posthogBreakdownSql(
  breakdown: PostHogBreakdown,
  host: string,
  range: ImportDayRange
): string {
  const where = `event = '$pageview'
  AND ${rangeCondition(range)}
  ${hostCondition(host)}`;
  const aliases = breakdown.dimensions.map((_, index) => `d${index}`);
  const groupBy = ["day", ...aliases].join(", ");
  // Rows a record would be dropped for never take one of the day's top
  // slots: empty values, and session rows without a session.
  const filled = aliases.map((alias) => `coalesce(${alias}, '') != ''`);
  const conditions = [
    ...(breakdown.scope === "sessions" && aliases.length > 0
      ? ["visits > 0"]
      : []),
    ...(breakdown.requires === "all" ? filled : []),
    ...(breakdown.requires === "any" && filled.length > 0
      ? [`(${filled.join(" OR ")})`]
      : []),
  ];
  const having =
    conditions.length > 0 ? `HAVING ${conditions.join(" AND ")}\n` : "";
  const limitBy = `${having}ORDER BY day, ${breakdown.scope === "events" ? "pageviews" : "visits"} DESC
LIMIT ${POSTHOG_RESULT_LIMIT} BY day
LIMIT ${POSTHOG_MAX_ROWS}`;
  if (breakdown.scope === "events") {
    const values = breakdown.dimensions
      .map(({ expression }, index) => `${expression} AS d${index}`)
      .join(", ");
    return `SELECT ${DAY_SQL} AS day, ${values},
  count() AS pageviews, uniq(person_id) AS visitors
FROM events
WHERE ${where}
GROUP BY ${groupBy}
${limitBy}`;
  }
  // Each session first, as PostHog's web analytics does; events without a
  // session each stand alone, so they add page views and visitors but no
  // visits. A session that runs past midnight adds page views to both days
  // but counts as a visit, with its bounce and duration, only on the day it
  // started, also when that day lies in an earlier chunk.
  const values = breakdown.dimensions
    .map(({ expression }, index) => `any(${expression}) AS d${index}`)
    .join(",\n    ");
  return `SELECT ${["day", ...aliases].join(", ")},
  sum(visit_views) AS pageviews,
  uniq(visit_person) AS visitors,
  countIf(has_session) AS visits,
  sumIf(visit_bounce, has_session) AS bounces,
  sumIf(visit_duration, has_session) AS duration
FROM (
  SELECT ${DAY_SQL} AS day,
    if(empty($session_id), toString(uuid), $session_id) AS visit,
    notEmpty(any($session_id))
      AND toDate(toTimeZone(any(session.$start_timestamp), 'UTC')) = day AS has_session,
    any(person_id) AS visit_person,
    count() AS visit_views,
    any(if(session.$is_bounce, 1, 0)) AS visit_bounce,
    any(session.$session_duration) AS visit_duration${values ? `,\n    ${values}` : ""}
  FROM events
  WHERE ${where}
  GROUP BY day, visit
)
GROUP BY ${groupBy}
${limitBy}`;
}

function toRecord(
  breakdown: PostHogBreakdown,
  host: string,
  row: unknown[]
): WebImportRecord | null {
  const width = breakdown.dimensions.length;
  const day = text(row[0]).slice(0, 10);
  const record: WebImportRecord = { grain: breakdown.grain, day, host };
  for (const [index, { field }] of breakdown.dimensions.entries()) {
    let value = text(row[1 + index]);
    if (field === "referrer" && value === POSTHOG_DIRECT_REFERRER) {
      value = "";
    }
    Object.assign(record, { [field]: value });
  }
  const counts = row.slice(1 + width).map(count);
  const [pageviews = 0, visitors = 0, visits, bounces, duration] = counts;
  record.pageviews = pageviews;
  record.visitors = visitors;
  if (breakdown.scope === "sessions") {
    record.visits = visits ?? 0;
    record.bounces = bounces ?? 0;
    record.visitDurationS = duration ?? 0;
    if (breakdown.grain === "entry_page") {
      record.entrances = record.visits;
    }
  }
  return keepRecord(breakdown, record) ? record : null;
}

/** Drops empty values and session rows that hold no session. */
function keepRecord(breakdown: PostHogBreakdown, record: WebImportRecord) {
  switch (breakdown.grain) {
    case "total":
      return (record.pageviews ?? 0) > 0;
    case "source":
      return (record.visits ?? 0) > 0;
    case "campaign":
      return (
        (record.visits ?? 0) > 0 &&
        Boolean(record.utmSource || record.utmMedium || record.utmCampaign)
      );
    case "entry_page":
      return (record.visits ?? 0) > 0 && Boolean(record.path);
    default:
      return breakdown.dimensions.every(({ field }) => Boolean(record[field]));
  }
}

/**
 * Daily totals plus the top 200 values per breakdown and day: one HogQL
 * query per grain, two at a time. Rows are filtered to the ref's host and
 * its www twin, since a project can track several sites, and are stored
 * under the import's host.
 */
export async function fetchPostHogChunk(
  credentials: PostHogCredentials,
  ref: string,
  host: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const source = parsePostHogSourceRef(ref);
  const readHost = source.host ?? host;
  const breakdowns = [TOTALS, ...POSTHOG_BREAKDOWNS];
  const results = await inBatches(
    breakdowns.map((breakdown) => async () => {
      const rows = await query(
        credentials,
        source.projectId,
        posthogBreakdownSql(breakdown, readHost, range),
        fetchImpl
      );
      return rows.flatMap((row) => {
        const record = toRecord(breakdown, host, row);
        return record ? [record] : [];
      });
    }),
    POSTHOG_CONCURRENCY
  );
  return results
    .flat()
    .filter((record) => record.day >= range.start && record.day <= range.end);
}
