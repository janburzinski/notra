import {
  PLAUSIBLE_API_URL,
  PLAUSIBLE_PAGE_LIMIT,
  PLAUSIBLE_SITES_MAX_PAGES,
  PLAUSIBLE_SITES_PAGE_LIMIT,
} from "../constants/analytics-imports";
import {
  plausibleQueryResponseSchema,
  plausibleSitesResponseSchema,
} from "../schemas/analytics-imports";
import type {
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  PlausibleCell,
  PlausibleCredentials,
  PlausibleGrainQuery,
  WebImportRecord,
} from "../types/analytics-imports";
import { importHostScope } from "../utils/analytics-import-host";
import { collectPages, importRequest } from "./http";
import { normalizeImportHost } from "./map-dimensions";

const PROVIDER = "plausible";
const SESSION_METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "bounce_rate",
  "visit_duration",
];

function text(value: PlausibleCell | undefined): string {
  return value == null ? "" : String(value);
}

/** The API reports averages; imported rows store totals like the CSV export. */
function sessionTotals(metrics: Record<string, number>) {
  const visits = metrics.visits ?? 0;
  return {
    visitors: metrics.visitors ?? 0,
    visits,
    pageviews: metrics.pageviews ?? 0,
    bounces: Math.round(((metrics.bounce_rate ?? 0) / 100) * visits),
    visitDurationS: Math.round((metrics.visit_duration ?? 0) * visits),
  };
}

/** Entry pages keep the host the visit started on, like totals by host. */
const GRAIN_QUERIES: PlausibleGrainQuery[] = [
  {
    grain: "total",
    dimensions: ["time:day"],
    metrics: SESSION_METRICS,
    toRecord: (_dimensions, metrics) => sessionTotals(metrics),
  },
  {
    grain: "page",
    dimensions: ["time:day", "event:hostname", "event:page"],
    metrics: ["visitors", "visits", "pageviews"],
    toRecord: ([, host, path], metrics) => ({
      host: text(host),
      path: text(path),
      visitors: metrics.visitors ?? 0,
      visits: metrics.visits ?? 0,
      pageviews: metrics.pageviews ?? 0,
    }),
  },
  {
    grain: "entry_page",
    dimensions: ["time:day", "visit:entry_page_hostname", "visit:entry_page"],
    metrics: SESSION_METRICS,
    toRecord: ([, host, path], metrics) => {
      const totals = sessionTotals(metrics);
      return {
        ...totals,
        host: text(host),
        path: text(path),
        entrances: totals.visits,
      };
    },
  },
  {
    grain: "source",
    dimensions: [
      "time:day",
      "visit:source",
      "visit:referrer",
      "visit:utm_source",
      "visit:utm_medium",
      "visit:utm_campaign",
      "visit:utm_term",
      "visit:utm_content",
    ],
    metrics: SESSION_METRICS,
    toRecord: (
      [
        ,
        source,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
      ],
      metrics
    ) => ({
      ...sessionTotals(metrics),
      sourceName: text(source),
      referrer: text(referrer),
      utmSource: text(utmSource),
      utmMedium: text(utmMedium),
      utmCampaign: text(utmCampaign),
      utmTerm: text(utmTerm),
      utmContent: text(utmContent),
    }),
  },
  ...(
    [
      ["country", "visit:country", "country"],
      ["device", "visit:device", "device"],
      ["browser", "visit:browser", "browser"],
      ["os", "visit:os", "os"],
    ] as const
  ).map(([grain, dimension, field]): PlausibleGrainQuery => ({
    grain,
    dimensions: ["time:day", dimension],
    metrics: SESSION_METRICS,
    toRecord: ([, value], metrics) => ({
      ...sessionTotals(metrics),
      [field]: text(value),
    }),
  })),
];

/**
 * Day totals per host the visit started on. Session metrics cannot be split
 * by `event:hostname`, so this is how a subdomain gets its own totals.
 */
const HOST_TOTALS_QUERY: PlausibleGrainQuery = {
  grain: "total",
  dimensions: ["time:day", "visit:entry_page_hostname"],
  metrics: SESSION_METRICS,
  toRecord: ([, host], metrics) => ({
    ...sessionTotals(metrics),
    host: text(host),
  }),
};

const TOTAL_METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "bounces",
  "visitDurationS",
] as const;

/**
 * Gives each subdomain its share of a day's totals and leaves the rest on the
 * site's own host, so the rows of a day add up to the exact site total. A
 * visitor who starts visits on two subdomains counts once in the site total
 * but once per host, so when the shares add up to more than the total they
 * are scaled down to fit.
 */
function splitPlausibleTotalsByHost(
  totals: readonly WebImportRecord[],
  byHost: readonly WebImportRecord[],
  siteId: string
): WebImportRecord[] {
  const site = importHostScope(siteId);
  const shares = byHost.filter((row) => {
    const host = importHostScope(normalizeImportHost(row.host));
    return host !== "" && host !== site;
  });
  return totals.flatMap((total) => {
    const dayShares = shares
      .filter((row) => row.day === total.day)
      .map((row) => ({ ...row }));
    const rest = { ...total };
    for (const metric of TOTAL_METRICS) {
      const whole = total[metric] ?? 0;
      const shared = dayShares.reduce(
        (sum, row) => sum + (row[metric] ?? 0),
        0
      );
      const scale = shared > whole ? whole / shared : 1;
      let given = 0;
      for (const row of dayShares) {
        const value = Math.floor((row[metric] ?? 0) * scale);
        row[metric] = value;
        given += value;
      }
      rest[metric] = whole - given;
    }
    return [rest, ...dayShares];
  });
}

function headers(credentials: PlausibleCredentials) {
  return {
    Authorization: `Bearer ${credentials.apiKey}`,
    "Content-Type": "application/json",
  };
}

async function query(
  credentials: PlausibleCredentials,
  body: Record<string, unknown>,
  fetchImpl?: ImportFetch
) {
  return await importRequest(
    PROVIDER,
    `${PLAUSIBLE_API_URL}/api/v2/query`,
    {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify(body),
    },
    plausibleQueryResponseSchema,
    fetchImpl
  );
}

/** Sites the key's team can read, for the source picker. Validates the key too. */
export async function listPlausibleSites(
  credentials: PlausibleCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  return await collectPages<string, ImportSource>(
    PLAUSIBLE_SITES_MAX_PAGES,
    async (after) => {
      const url = new URL(`${PLAUSIBLE_API_URL}/api/v1/sites`);
      url.searchParams.set("limit", String(PLAUSIBLE_SITES_PAGE_LIMIT));
      if (after) {
        url.searchParams.set("after", after);
      }
      const response = await importRequest(
        PROVIDER,
        url.toString(),
        { headers: headers(credentials) },
        plausibleSitesResponseSchema,
        fetchImpl
      );
      return {
        items: response.sites.map((site) => ({
          ref: site.domain,
          label: site.domain,
          host: site.domain,
          provider: PROVIDER,
          kind: "web",
        })),
        next: response.meta?.after,
      };
    }
  );
}

/** First month with page views and the all-time total, in one cheap call. */
export async function previewPlausibleSite(
  credentials: PlausibleCredentials,
  siteId: string,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const response = await query(
    credentials,
    {
      site_id: siteId,
      date_range: "all",
      metrics: ["pageviews"],
      dimensions: ["time:month"],
      order_by: [["time:month", "asc"]],
    },
    fetchImpl
  );
  let earliestDay: string | null = null;
  let pageviews = 0;
  const pageviewsByMonth: Record<string, number> = {};
  for (const row of response.results) {
    const views = Number(row.metrics[0] ?? 0);
    pageviews += views;
    const month = text(row.dimensions[0]).slice(0, 7);
    if (month) {
      pageviewsByMonth[month] = (pageviewsByMonth[month] ?? 0) + views;
    }
    if (!earliestDay && views > 0) {
      earliestDay = text(row.dimensions[0]).slice(0, 10) || null;
    }
  }
  return { earliestDay, pageviews, pageviewsByMonth };
}

/** One grain for a chunk of days, paged by total_rows. */
async function fetchPlausibleGrain(
  credentials: PlausibleCredentials,
  siteId: string,
  range: ImportDayRange,
  spec: PlausibleGrainQuery,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  return await collectPages<number, WebImportRecord>(
    Number.POSITIVE_INFINITY,
    async (offset = 0) => {
      const response = await query(
        credentials,
        {
          site_id: siteId,
          date_range: [range.start, range.end],
          metrics: spec.metrics,
          dimensions: spec.dimensions,
          include: { total_rows: true },
          pagination: { limit: PLAUSIBLE_PAGE_LIMIT, offset },
        },
        fetchImpl
      );
      const total = response.meta?.total_rows ?? 0;
      const last =
        response.results.length < PLAUSIBLE_PAGE_LIMIT ||
        offset + PLAUSIBLE_PAGE_LIMIT >= total;
      return {
        items: response.results.map((row) => {
          const metrics = Object.fromEntries(
            spec.metrics.map((name, index) => [
              name,
              Number(row.metrics[index] ?? 0),
            ])
          );
          return {
            grain: spec.grain,
            day: text(row.dimensions[0]).slice(0, 10),
            ...spec.toRecord(row.dimensions, metrics),
          };
        }),
        next: last ? null : offset + PLAUSIBLE_PAGE_LIMIT,
      };
    }
  );
}

/**
 * Every grain for one chunk of days, paged by total_rows. Wildcards are never
 * sent: only exact day ranges and fixed dimensions are queried.
 */
export async function fetchPlausibleChunk(
  credentials: PlausibleCredentials,
  siteId: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const records: WebImportRecord[] = [];
  for (const spec of GRAIN_QUERIES) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- grains share one rate-limited key
    records.push(
      ...(await fetchPlausibleGrain(
        credentials,
        siteId,
        range,
        spec,
        fetchImpl
      ))
    );
  }
  const byHost = await fetchPlausibleGrain(
    credentials,
    siteId,
    range,
    HOST_TOTALS_QUERY,
    fetchImpl
  );
  const totals = records.filter((record) => record.grain === "total");
  return [
    ...records.filter((record) => record.grain !== "total"),
    ...splitPlausibleTotalsByHost(totals, byHost, siteId),
  ];
}
