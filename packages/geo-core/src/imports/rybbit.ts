import {
  RYBBIT_API_URL,
  RYBBIT_CONCURRENCY,
  RYBBIT_HISTORY_START,
  RYBBIT_RESULT_LIMIT,
} from "../constants/analytics-imports";
import {
  rybbitMetricResponseSchema,
  rybbitOrganizationsResponseSchema,
  rybbitTimeSeriesResponseSchema,
} from "../schemas/analytics-imports";
import type {
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  RybbitBreakdown,
  RybbitCredentials,
  WebImportRecord,
} from "../types/analytics-imports";
import { daysInRange } from "../utils/analytics-import-range";
import { importRequest } from "./http";

const PROVIDER = "rybbit";
/** Notra stores UTC days; Rybbit cuts days in the zone it is asked for. */
const TIME_ZONE = "UTC";

/** Breakdowns per day; `count` is sessions for every one of them. */
const RYBBIT_BREAKDOWNS: readonly RybbitBreakdown[] = [
  { grain: "page", parameter: "pathname", field: "path" },
  { grain: "entry_page", parameter: "entry_page", field: "path" },
  { grain: "source", parameter: "referrer", field: "referrer" },
  { grain: "campaign", parameter: "utm_source", field: "utmSource" },
  { grain: "country", parameter: "country", field: "country" },
  { grain: "device", parameter: "device_type", field: "device" },
  { grain: "browser", parameter: "browser", field: "browser" },
  { grain: "os", parameter: "operating_system", field: "os" },
];

function headers(credentials: RybbitCredentials) {
  return { Authorization: `Bearer ${credentials.apiKey}` };
}

function siteUrl(
  siteId: string,
  endpoint: string,
  range: ImportDayRange,
  params: Record<string, string>
): string {
  const url = new URL(
    `${RYBBIT_API_URL}/api/sites/${encodeURIComponent(siteId)}/${endpoint}`
  );
  url.searchParams.set("start_date", range.start);
  url.searchParams.set("end_date", range.end);
  url.searchParams.set("time_zone", TIME_ZONE);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

/** Bounced sessions from Rybbit's percentage. */
function bounces(sessions: number, bounceRate: number): number {
  return Math.round((bounceRate / 100) * sessions);
}

/** Sites in every organization the key can read; also validates the key. */
export async function listRybbitSites(
  credentials: RybbitCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  const organizations = await importRequest(
    PROVIDER,
    `${RYBBIT_API_URL}/api/organizations`,
    { headers: headers(credentials) },
    rybbitOrganizationsResponseSchema,
    fetchImpl
  );
  const multiple = organizations.length > 1;
  const sources = organizations.flatMap((organization) =>
    organization.sites.flatMap((site): ImportSource[] => {
      const ref = String(site.siteId ?? site.id ?? "");
      if (!ref) {
        return [];
      }
      const name = site.name || site.domain || ref;
      return [
        {
          ref,
          label:
            multiple && organization.name
              ? `${organization.name} / ${name}`
              : name,
          host: site.domain ?? "",
          provider: PROVIDER,
          kind: "web",
        },
      ];
    })
  );
  // `/api/organizations` needs no scope, so a key without analytics:read
  // would pass here and fail every chunk; one analytics call rejects it now.
  const [first] = sources;
  if (first) {
    const today = new Date().toISOString().slice(0, 10);
    await timeSeries(
      credentials,
      first.ref,
      "month",
      { start: today, end: today },
      fetchImpl
    );
  }
  return sources;
}

async function timeSeries(
  credentials: RybbitCredentials,
  siteId: string,
  bucket: "day" | "month",
  range: ImportDayRange,
  fetchImpl?: ImportFetch
) {
  const response = await importRequest(
    PROVIDER,
    siteUrl(siteId, "overview/time-series", range, { bucket }),
    { headers: headers(credentials) },
    rybbitTimeSeriesResponseSchema,
    fetchImpl
  );
  return response.data;
}

/** First month with page views and the total, in one by-month query. */
export async function previewRybbitSite(
  credentials: RybbitCredentials,
  siteId: string,
  today: string,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const months = await timeSeries(
    credentials,
    siteId,
    "month",
    { start: RYBBIT_HISTORY_START, end: today },
    fetchImpl
  );
  let earliestDay: string | null = null;
  let pageviews = 0;
  const pageviewsByMonth: Record<string, number> = {};
  for (const row of months.toSorted((a, b) => a.time.localeCompare(b.time))) {
    const month = row.time.slice(0, 7);
    pageviews += row.pageviews;
    pageviewsByMonth[month] = (pageviewsByMonth[month] ?? 0) + row.pageviews;
    if (!earliestDay && row.pageviews > 0) {
      earliestDay = `${month}-01`;
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
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounded concurrency against one key
    results.push(
      ...(await Promise.all(
        tasks.slice(index, index + concurrency).map((task) => task())
      ))
    );
  }
  return results;
}

/**
 * Daily totals plus the top 200 values per breakdown and day. Rybbit
 * reports sessions per value, not unique visitors, so breakdown rows carry
 * visits and page views only.
 */
export async function fetchRybbitChunk(
  credentials: RybbitCredentials,
  siteId: string,
  host: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const records: WebImportRecord[] = [];
  for (const row of await timeSeries(
    credentials,
    siteId,
    "day",
    range,
    fetchImpl
  )) {
    // Rybbit fills empty days with zeros; they carry nothing to store.
    if (row.sessions === 0 && row.pageviews === 0) {
      continue;
    }
    records.push({
      grain: "total",
      day: row.time.slice(0, 10),
      host,
      pageviews: row.pageviews,
      visitors: row.users,
      visits: row.sessions,
      bounces: bounces(row.sessions, row.bounce_rate),
      visitDurationS: Math.round(row.session_duration * row.sessions),
    });
  }
  const tasks = daysInRange(range).flatMap((day) =>
    RYBBIT_BREAKDOWNS.map((breakdown) => async () => {
      const response = await importRequest(
        PROVIDER,
        siteUrl(
          siteId,
          "metric",
          { start: day, end: day },
          {
            parameter: breakdown.parameter,
            limit: String(RYBBIT_RESULT_LIMIT),
          }
        ),
        { headers: headers(credentials) },
        rybbitMetricResponseSchema,
        fetchImpl
      );
      return response.data.data.flatMap((row): WebImportRecord[] => {
        const value = String(row.value ?? "");
        if (breakdown.grain === "campaign" && !value) {
          return [];
        }
        return [
          {
            grain: breakdown.grain,
            day,
            host,
            [breakdown.field]: value,
            pageviews: row.pageviews,
            visits: row.count,
            ...(breakdown.grain === "entry_page"
              ? { entrances: row.count }
              : {}),
            ...(breakdown.grain === "page"
              ? {}
              : { bounces: bounces(row.count, row.bounce_rate) }),
          },
        ];
      });
    })
  );
  for (const rows of await inBatches(tasks, RYBBIT_CONCURRENCY)) {
    records.push(...rows);
  }
  return records.filter(
    (record) => record.day >= range.start && record.day <= range.end
  );
}
