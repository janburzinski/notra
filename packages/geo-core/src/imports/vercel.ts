import {
  VERCEL_API_URL,
  VERCEL_CONCURRENCY,
  VERCEL_OTHERS_GROUP,
  VERCEL_PROJECTS_MAX_PAGES,
  VERCEL_PROJECTS_PAGE_LIMIT,
  VERCEL_RESULT_LIMIT,
} from "../constants/analytics-imports";
import { ImportProviderError } from "../schemas/analytics-import-errors";
import {
  vercelAggregateResponseSchema,
  vercelProjectsResponseSchema,
} from "../schemas/analytics-imports";
import type {
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  VercelBreakdown,
  VercelCredentials,
  WebImportRecord,
} from "../types/analytics-imports";
import { addDays, daysInRange, toDay } from "../utils/analytics-import-range";
import { collectPages, importRequest } from "./http";

const PROVIDER = "vercel";
const PRODUCTION_FILTER = "environment eq 'production'";
/** Hobby (and other plans) answer older ranges with "...only grants access to the latest 31 days of data." */
const RETENTION_ERROR = /latest (\d+) days/i;

/** Breakdowns per day; totals come from a separate by=day query so they stay exact. */
const VERCEL_BREAKDOWNS: readonly VercelBreakdown[] = [
  { grain: "page", dimension: "requestPath", field: "path" },
  { grain: "source", dimension: "referrerHostname", field: "referrer" },
  { grain: "campaign", dimension: "utmSource", field: "utmSource" },
  { grain: "country", dimension: "country", field: "country" },
  { grain: "device", dimension: "deviceType", field: "device" },
  { grain: "browser", dimension: "browserName", field: "browser" },
  { grain: "os", dimension: "osName", field: "os" },
];

function headers(credentials: VercelCredentials) {
  return { Authorization: `Bearer ${credentials.token}` };
}

function metric(row: Record<string, unknown>, ...names: string[]): number {
  for (const name of names) {
    const value = Number(row[name]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function aggregateUrl(
  credentials: VercelCredentials,
  projectId: string,
  by: string[],
  since: string,
  until: string
): string {
  const url = new URL(
    `${VERCEL_API_URL}/v1/query/web-analytics/visits/aggregate`
  );
  url.searchParams.set("projectId", projectId);
  for (const dimension of by) {
    url.searchParams.append("by", dimension);
  }
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("limit", String(VERCEL_RESULT_LIMIT));
  url.searchParams.set("filter", PRODUCTION_FILTER);
  if (credentials.teamId) {
    url.searchParams.set("teamId", credentials.teamId);
  }
  return url.toString();
}

/** Projects the token can read; also validates the token and team. */
export async function listVercelProjects(
  credentials: VercelCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  return await collectPages<number, ImportSource>(
    VERCEL_PROJECTS_MAX_PAGES,
    async (until) => {
      const url = new URL(`${VERCEL_API_URL}/v9/projects`);
      url.searchParams.set("limit", String(VERCEL_PROJECTS_PAGE_LIMIT));
      if (credentials.teamId) {
        url.searchParams.set("teamId", credentials.teamId);
      }
      if (until) {
        url.searchParams.set("until", String(until));
      }
      const response = await importRequest(
        PROVIDER,
        url.toString(),
        { headers: headers(credentials) },
        vercelProjectsResponseSchema,
        fetchImpl
      );
      return {
        items: response.projects.map((project) => ({
          ref: project.id,
          label: project.name,
          host: project.targets?.production?.alias?.[0] ?? "",
          provider: PROVIDER,
          kind: "web",
        })),
        next: response.pagination?.next,
      };
    }
  );
}

/** Days the plan keeps when Vercel rejected the range for its age, else null. */
function retentionDays(error: unknown): number | null {
  if (!(error instanceof ImportProviderError) || error.status !== 400) {
    return null;
  }
  const days = Number(RETENTION_ERROR.exec(error.detail)?.[1]);
  return Number.isInteger(days) && days > 0 ? days : null;
}

async function aggregateOnce(
  credentials: VercelCredentials,
  projectId: string,
  by: string[],
  range: ImportDayRange,
  fetchImpl?: ImportFetch
) {
  const response = await importRequest(
    PROVIDER,
    aggregateUrl(
      credentials,
      projectId,
      by,
      `${range.start}T00:00:00.000Z`,
      `${range.end}T23:59:59.999Z`
    ),
    { headers: headers(credentials) },
    vercelAggregateResponseSchema,
    fetchImpl
  );
  return response.data;
}

/**
 * Rows plus the range they cover. When the plan keeps less history than asked
 * for, the start moves up to the oldest day it still serves and the query
 * runs again; a range entirely outside it comes back empty with no range.
 */
async function aggregate(
  credentials: VercelCredentials,
  projectId: string,
  by: string[],
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<{ rows: Record<string, unknown>[]; range: ImportDayRange | null }> {
  try {
    return {
      rows: await aggregateOnce(credentials, projectId, by, range, fetchImpl),
      range,
    };
  } catch (error) {
    const days = retentionDays(error);
    // Midnight of the (days - 1)th day back is less than `days` × 24 h ago at
    // any time of day, so the retry always lands inside the window.
    const start = days ? addDays(toDay(new Date()), -(days - 1)) : null;
    if (!start || start <= range.start) {
      throw error;
    }
    if (start > range.end) {
      return { rows: [], range: null };
    }
    const clamped = { start, end: range.end };
    return {
      rows: await aggregateOnce(credentials, projectId, by, clamped, fetchImpl),
      range: clamped,
    };
  }
}

/**
 * First month with page views and the total in one by=month query. Hobby and
 * Pro keep less than the longest retention, so months before the data starts
 * are never planned as chunks.
 */
export async function previewVercelProject(
  credentials: VercelCredentials,
  projectId: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const { rows: months, range: served } = await aggregate(
    credentials,
    projectId,
    ["month"],
    range,
    fetchImpl
  );
  if (!served) {
    return { earliestDay: null, pageviews: 0, pageviewsByMonth: {} };
  }
  let earliestDay: string | null = null;
  let pageviews = 0;
  const pageviewsByMonth: Record<string, number> = {};
  for (const row of months.toSorted((a, b) =>
    String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""))
  )) {
    const views = metric(row, "pageviews", "total");
    pageviews += views;
    const month = String(row.timestamp ?? "").slice(0, 10);
    if (month) {
      const key = month.slice(0, 7);
      pageviewsByMonth[key] = (pageviewsByMonth[key] ?? 0) + views;
    }
    if (!earliestDay && views > 0 && month) {
      earliestDay = month < served.start ? served.start : month;
    }
  }
  return { earliestDay, pageviews, pageviewsByMonth };
}

async function inBatches<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < tasks.length; index += concurrency) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounded concurrency against one token
    results.push(
      ...(await Promise.all(
        tasks.slice(index, index + concurrency).map((task) => task())
      ))
    );
  }
  return results;
}

/**
 * Daily totals plus top-100 breakdowns per day (production only). Values
 * Vercel folds into "Others" are dropped, so breakdowns can sum below totals.
 */
export async function fetchVercelChunk(
  credentials: VercelCredentials,
  projectId: string,
  host: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const records: WebImportRecord[] = [];
  const { rows: totals, range: served } = await aggregate(
    credentials,
    projectId,
    ["day"],
    range,
    fetchImpl
  );
  if (!served) {
    return records;
  }
  for (const row of totals) {
    records.push({
      grain: "total",
      day: String(row.timestamp ?? "").slice(0, 10),
      host,
      pageviews: metric(row, "pageviews", "total"),
      visitors: metric(row, "visitors", "devices"),
    });
  }
  const tasks = daysInRange(served).flatMap((day) =>
    VERCEL_BREAKDOWNS.map((breakdown) => async () => {
      const { rows } = await aggregate(
        credentials,
        projectId,
        [breakdown.dimension],
        { start: day, end: day },
        fetchImpl
      );
      return rows.flatMap((row): WebImportRecord[] => {
        const value = String(row[breakdown.dimension] ?? "");
        if (
          value === VERCEL_OTHERS_GROUP ||
          (breakdown.grain === "campaign" && !value)
        ) {
          return [];
        }
        return [
          {
            grain: breakdown.grain,
            day,
            host,
            [breakdown.field]: value,
            pageviews: metric(row, "pageviews", "total"),
            visitors: metric(row, "visitors", "devices"),
          },
        ];
      });
    })
  );
  for (const rows of await inBatches(tasks, VERCEL_CONCURRENCY)) {
    records.push(...rows);
  }
  return records.filter(
    (record) => record.day >= served.start && record.day <= served.end
  );
}
