import type { z } from "zod";

import {
  DATABUDDY_API_URL,
  DATABUDDY_HISTORY_START,
  DATABUDDY_PREVIEW_LIMIT,
  DATABUDDY_RESULT_LIMIT,
} from "../constants/analytics-imports";
import { ImportProviderError } from "../schemas/analytics-import-errors";
import {
  databuddyBreakdownRowSchema,
  databuddyDaySchema,
  databuddyQueryResponseSchema,
  databuddyWebsitesResponseSchema,
} from "../schemas/analytics-imports";
import type {
  DatabuddyBreakdown,
  DatabuddyCredentials,
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  WebImportRecord,
} from "../types/analytics-imports";
import { daysInRange } from "../utils/analytics-import-range";
import { importRequest } from "./http";

const PROVIDER = "databuddy";
const TOTALS_ID = "totals";

/**
 * Breakdowns per day. Databuddy reports page views and unique visitors per
 * value, but no sessions; `entry_pages` counts the sessions that started on
 * a page in its `pageviews`.
 */
const DATABUDDY_BREAKDOWNS: readonly DatabuddyBreakdown[] = [
  { grain: "page", query: "top_pages", field: "path" },
  { grain: "entry_page", query: "entry_pages", field: "path" },
  { grain: "source", query: "top_referrers", field: "referrer" },
  { grain: "campaign", query: "utm_sources", field: "utmSource" },
  { grain: "country", query: "country", field: "country" },
  { grain: "device", query: "device_types", field: "device" },
  { grain: "browser", query: "browser_name", field: "browser" },
  { grain: "os", query: "os_name", field: "os" },
];

type DatabuddyQueryResult = z.infer<
  typeof databuddyQueryResponseSchema
>["data"][number];

function headers(credentials: DatabuddyCredentials) {
  return {
    "x-api-key": credentials.apiKey,
    "content-type": "application/json",
  };
}

/** Bounced sessions from Databuddy's percentage. */
function bounces(sessions: number, bounceRate: number): number {
  return Math.round((bounceRate / 100) * sessions);
}

/** `entry_pages` returns paths still percent-encoded; `top_pages` doesn't. */
function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Websites the key can read. A key without `read:data` gets 401 here, so
 * this one call also checks its scope.
 */
export async function listDatabuddyWebsites(
  credentials: DatabuddyCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  const { websites } = await importRequest(
    PROVIDER,
    `${DATABUDDY_API_URL}/v1/query/websites`,
    { headers: headers(credentials) },
    databuddyWebsitesResponseSchema,
    fetchImpl
  );
  const organizations = new Set(
    websites.map((website) => website.organizationName ?? "")
  );
  return websites.map((website) => {
    const name = website.name || website.domain || website.id;
    return {
      ref: website.id,
      label:
        organizations.size > 1 && website.organizationName
          ? `${website.organizationName} / ${name}`
          : name,
      host: website.domain ?? "",
      provider: PROVIDER,
      kind: "web",
    };
  });
}

/**
 * Runs a batch of queries in one request and returns their rows by id.
 * A query Databuddy failed to run is an error, never an empty day.
 */
async function query(
  credentials: DatabuddyCredentials,
  websiteId: string,
  body: {
    startDate: string;
    endDate: string;
    limit: number;
    parameters: {
      name: string;
      id: string;
      start_date?: string;
      end_date?: string;
    }[];
  },
  fetchImpl?: ImportFetch
): Promise<Map<string, unknown[]>> {
  const url = new URL(`${DATABUDDY_API_URL}/v1/query`);
  url.searchParams.set("website_id", websiteId);
  // Notra stores UTC days; Databuddy only reads the zone from the URL.
  url.searchParams.set("timezone", "UTC");
  const response = await importRequest(
    PROVIDER,
    url.toString(),
    {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify({ ...body, granularity: "daily", page: 1 }),
    },
    databuddyQueryResponseSchema,
    fetchImpl
  );
  const results = new Map<string, DatabuddyQueryResult>(
    response.data.map((result) => [result.parameter, result])
  );
  const rows = new Map<string, unknown[]>();
  for (const { id } of body.parameters) {
    const result = results.get(id);
    if (!result?.success) {
      throw new ImportProviderError({
        provider: PROVIDER,
        detail: `query ${id} failed: ${result?.error ?? "missing from the response"}`,
      });
    }
    rows.set(id, result.data);
  }
  return rows;
}

function parseRows<T>(schema: z.ZodType<T>, rows: unknown[] | undefined): T[] {
  const parsed = schema.array().safeParse(rows ?? []);
  if (!parsed.success) {
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: "unexpected response shape",
    });
  }
  return parsed.data;
}

/** First day with page views and the total, in one by-day query. */
export async function previewDatabuddyWebsite(
  credentials: DatabuddyCredentials,
  websiteId: string,
  today: string,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const rows = await query(
    credentials,
    websiteId,
    {
      startDate: DATABUDDY_HISTORY_START,
      endDate: today,
      limit: DATABUDDY_PREVIEW_LIMIT,
      parameters: [{ name: "events_by_date", id: TOTALS_ID }],
    },
    fetchImpl
  );
  let earliestDay: string | null = null;
  let pageviews = 0;
  const pageviewsByMonth: Record<string, number> = {};
  const days = parseRows(databuddyDaySchema, rows.get(TOTALS_ID));
  for (const row of days.toSorted((a, b) => a.date.localeCompare(b.date))) {
    const month = row.date.slice(0, 7);
    pageviews += row.pageviews;
    pageviewsByMonth[month] = (pageviewsByMonth[month] ?? 0) + row.pageviews;
    if (!earliestDay && row.pageviews > 0) {
      earliestDay = row.date.slice(0, 10);
    }
  }
  return { earliestDay, pageviews, pageviewsByMonth };
}

function breakdownRecord(
  breakdown: DatabuddyBreakdown,
  day: string,
  host: string,
  row: z.infer<typeof databuddyBreakdownRowSchema>
): WebImportRecord | null {
  const name = String(row.name ?? "");
  const base = { grain: breakdown.grain, day, host };
  switch (breakdown.grain) {
    case "entry_page":
      return {
        ...base,
        path: decodePath(name),
        pageviews: 0,
        visitors: row.visitors,
        visits: row.pageviews,
        entrances: row.pageviews,
      };
    case "source":
      // `name` is a display label ("ChatGPT"); `domain` is the hostname.
      return row.domain
        ? {
            ...base,
            referrer: row.domain,
            pageviews: row.pageviews,
            visitors: row.visitors,
          }
        : null;
    case "country":
      return {
        ...base,
        country: row.country_code || name,
        pageviews: row.pageviews,
        visitors: row.visitors,
      };
    default:
      return name
        ? {
            ...base,
            [breakdown.field]: name,
            pageviews: row.pageviews,
            visitors: row.visitors,
          }
        : null;
  }
}

/**
 * Daily totals plus the top 200 values per breakdown and day, all in one
 * request. Breakdown rows carry page views and visitors only; Databuddy has
 * no sessions or bounces per value. Session duration is Databuddy's daily
 * median times the day's sessions, as it reports no total.
 */
export async function fetchDatabuddyChunk(
  credentials: DatabuddyCredentials,
  websiteId: string,
  host: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const days = daysInRange(range);
  const breakdownId = (breakdown: DatabuddyBreakdown, day: string) =>
    `${breakdown.query}:${day}`;
  const rows = await query(
    credentials,
    websiteId,
    {
      startDate: range.start,
      endDate: range.end,
      limit: DATABUDDY_RESULT_LIMIT,
      parameters: [
        { name: "events_by_date", id: TOTALS_ID },
        ...days.flatMap((day) =>
          DATABUDDY_BREAKDOWNS.map((breakdown) => ({
            name: breakdown.query,
            id: breakdownId(breakdown, day),
            start_date: day,
            end_date: day,
          }))
        ),
      ],
    },
    fetchImpl
  );
  const records: WebImportRecord[] = [];
  for (const row of parseRows(databuddyDaySchema, rows.get(TOTALS_ID))) {
    if (row.pageviews === 0 && row.sessions === 0) {
      continue;
    }
    records.push({
      grain: "total",
      day: row.date.slice(0, 10),
      host,
      pageviews: row.pageviews,
      visitors: row.visitors,
      visits: row.sessions,
      bounces: bounces(row.sessions, row.bounce_rate),
      visitDurationS: Math.round(row.median_session_duration * row.sessions),
    });
  }
  for (const day of days) {
    for (const breakdown of DATABUDDY_BREAKDOWNS) {
      for (const row of parseRows(
        databuddyBreakdownRowSchema,
        rows.get(breakdownId(breakdown, day))
      )) {
        const record = breakdownRecord(breakdown, day, host, row);
        if (record) {
          records.push(record);
        }
      }
    }
  }
  return records.filter(
    (record) => record.day >= range.start && record.day <= range.end
  );
}
