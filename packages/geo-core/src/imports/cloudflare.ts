import { AI_AGENT_SIGNATURES } from "@usenotra/geo/signatures";
import type { z } from "zod";

import {
  CLOUDFLARE_API_URL,
  CLOUDFLARE_AUTH_ERROR_CODE_PATTERN,
  CLOUDFLARE_CRAWLER_DATASET,
  CLOUDFLARE_DAY_SPLIT_MS,
  CLOUDFLARE_LIST_MAX_PAGES,
  CLOUDFLARE_LIST_PAGE_SIZE,
  CLOUDFLARE_MIN_SPLIT_MS,
  CLOUDFLARE_PAGE_LIMIT,
  CLOUDFLARE_RATE_LIMIT_RETRY_SECONDS,
  CLOUDFLARE_RETENTION_MARGIN_MS,
  CLOUDFLARE_RUM_DATASET,
  CLOUDFLARE_RUM_QUERIES,
  CLOUDFLARE_RUM_REF_SEPARATOR,
  CLOUDFLARE_USER_AGENT_FILTER_SIZE,
} from "../constants/analytics-imports";
import {
  ImportAuthError,
  ImportProviderError,
  ImportRateLimitedError,
} from "../schemas/analytics-import-errors";
import {
  cloudflareCrawlerGroupSchema,
  cloudflareDatasetSettingsSchema,
  cloudflareGraphqlResponseSchema,
  cloudflareListResponseSchema,
  cloudflareRumGroupSchema,
  cloudflareRumSiteSchema,
  cloudflareZoneSchema,
} from "../schemas/analytics-imports";
import type {
  CloudflareCredentials,
  CloudflareDatasetLimits,
  GeoImportRecord,
  ImportDayRange,
  ImportFetch,
  ImportPreview,
  ImportSource,
  ImportWebGrain,
  WebImportRecord,
} from "../types/analytics-imports";
import {
  addDays,
  daysInRange,
  importChunks,
  toDay,
} from "../utils/analytics-import-range";
import { collectPages, importRequest } from "./http";
import { readImportDimensions } from "./map-dimensions";

const PROVIDER = "cloudflare";

const CRAWLER_QUERY = `query ($zone: string!, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      httpRequestsAdaptiveGroups(limit: ${CLOUDFLARE_PAGE_LIMIT}, orderBy: [count_DESC], filter: $filter) {
        count
        avg { sampleInterval }
        dimensions { date clientRequestHTTPHost clientRequestPath userAgent verifiedBotCategory edgeResponseStatus }
      }
    }
  }
}`;

function headers(credentials: CloudflareCredentials) {
  return {
    Authorization: `Bearer ${credentials.apiToken}`,
    "Content-Type": "application/json",
  };
}

/** {@link importRequest}, with Cloudflare's 400 answers to a bad token as auth errors. */
async function cloudflareRequest<T>(
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  fetchImpl?: ImportFetch
): Promise<T> {
  try {
    return await importRequest(PROVIDER, url, init, schema, fetchImpl);
  } catch (error) {
    if (
      error instanceof ImportProviderError &&
      error.status === 400 &&
      CLOUDFLARE_AUTH_ERROR_CODE_PATTERN.test(error.detail)
    ) {
      throw new ImportAuthError({ provider: PROVIDER, status: error.status });
    }
    throw error;
  }
}

/** userAgent filters built from the AI crawler signatures we classify live. */
export function cloudflareUserAgentFilters(): Record<string, string>[][] {
  const filters = AI_AGENT_SIGNATURES.flatMap((signature) =>
    signature.userAgents.map((userAgent): Record<string, string> =>
      signature.match === "exact"
        ? { userAgent }
        : { userAgent_like: `%${userAgent}%` }
    )
  );
  const groups: Record<string, string>[][] = [];
  for (
    let index = 0;
    index < filters.length;
    index += CLOUDFLARE_USER_AGENT_FILTER_SIZE
  ) {
    groups.push(
      filters.slice(index, index + CLOUDFLARE_USER_AGENT_FILTER_SIZE)
    );
  }
  return groups;
}

async function graphqlValue<T>(
  credentials: CloudflareCredentials,
  queryText: string,
  variables: Record<string, unknown>,
  path: readonly (string | number)[],
  schema: z.ZodType<T>,
  fetchImpl?: ImportFetch
): Promise<T> {
  const response = await cloudflareRequest(
    `${CLOUDFLARE_API_URL}/graphql`,
    {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify({ query: queryText, variables }),
    },
    cloudflareGraphqlResponseSchema,
    fetchImpl
  );
  const errors = response.errors ?? [];
  if (errors.length > 0) {
    const message = errors.map((error) => error.message).join("; ");
    if (/rate limit|budget depleted|too many/i.test(message)) {
      throw new ImportRateLimitedError({
        provider: PROVIDER,
        retryAfterSeconds: CLOUDFLARE_RATE_LIMIT_RETRY_SECONDS,
      });
    }
    if (/not authorized|authentication|permission|access/i.test(message)) {
      throw new ImportAuthError({ provider: PROVIDER });
    }
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: message.slice(0, 300),
    });
  }
  const parsed = schema.safeParse(pick(response.data, path));
  if (!parsed.success) {
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: "unexpected GraphQL shape",
    });
  }
  return parsed.data;
}

async function graphql<T>(
  credentials: CloudflareCredentials,
  queryText: string,
  variables: Record<string, unknown>,
  rowsPath: readonly (string | number)[],
  rowSchema: z.ZodType<T>,
  fetchImpl?: ImportFetch
): Promise<T[]> {
  const rows = await graphqlValue(
    credentials,
    queryText,
    variables,
    rowsPath,
    rowSchema.array().nullish(),
    fetchImpl
  );
  return rows ?? [];
}

function pick(data: unknown, path: readonly (string | number)[]): unknown {
  let value = data;
  for (const key of path) {
    if (value == null || typeof value !== "object") {
      return undefined;
    }
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}

async function listAll<TItem>(
  credentials: CloudflareCredentials,
  path: string,
  item: z.ZodType<TItem>,
  fetchImpl?: ImportFetch
): Promise<TItem[]> {
  const schema = cloudflareListResponseSchema(item);
  return await collectPages<number, TItem>(
    CLOUDFLARE_LIST_MAX_PAGES,
    async (page = 1) => {
      const url = new URL(`${CLOUDFLARE_API_URL}${path}`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(CLOUDFLARE_LIST_PAGE_SIZE));
      const response = await cloudflareRequest(
        url.toString(),
        { headers: headers(credentials) },
        schema,
        fetchImpl
      );
      const totalPages = response.result_info?.total_pages ?? page;
      return {
        items: response.result ?? [],
        next: totalPages > page ? page + 1 : null,
      };
    }
  );
}

/**
 * Zones (AI crawler backfill) and Web Analytics sites (page views) the token
 * can read. Listing sites needs Account Settings Read and querying them
 * Account Analytics Read; zones without either still work. A site's ref is
 * its account and site tag, as fetchCloudflareRumChunk reads it.
 */
export async function listCloudflareSources(
  credentials: CloudflareCredentials,
  fetchImpl?: ImportFetch
): Promise<ImportSource[]> {
  const zones = await listAll(
    credentials,
    "/zones",
    cloudflareZoneSchema,
    fetchImpl
  );
  const sources: ImportSource[] = zones.map((zone) => ({
    ref: zone.id,
    label: zone.name,
    host: zone.name,
    provider: "cloudflare",
    kind: "geo",
  }));
  const accounts = [
    ...new Set(zones.map((zone) => zone.account?.id ?? "").filter(Boolean)),
  ];
  for (const account of accounts) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one listing per account, usually one
      const sites = await listAll(
        credentials,
        `/accounts/${account}/rum/site_info/list`,
        cloudflareRumSiteSchema,
        fetchImpl
      );
      for (const site of sites) {
        const host = site.rules?.[0]?.host ?? site.ruleset?.zone_name ?? "";
        sources.push({
          ref: `${account}${CLOUDFLARE_RUM_REF_SEPARATOR}${site.site_tag}`,
          label: host || site.site_tag,
          host,
          provider: "cloudflare_rum",
          kind: "web",
        });
      }
    } catch (error) {
      if (!(error instanceof ImportAuthError)) {
        throw error;
      }
    }
  }
  return sources;
}

function dayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function settingsQuery(scope: "zones" | "accounts", dataset: string): string {
  const tag = scope === "zones" ? "zoneTag" : "accountTag";
  return `query ($tag: string!) {
  viewer {
    ${scope}(filter: { ${tag}: $tag }) {
      settings { ${dataset} { enabled notOlderThan maxDuration } }
    }
  }
}`;
}

/** How far back and how wide one query may read a dataset; both depend on the plan. */
async function datasetLimits(
  credentials: CloudflareCredentials,
  scope: "zones" | "accounts",
  tag: string,
  dataset: string,
  fetchImpl?: ImportFetch
): Promise<CloudflareDatasetLimits> {
  const settings = await graphqlValue(
    credentials,
    settingsQuery(scope, dataset),
    { tag },
    ["viewer", scope, 0, "settings", dataset],
    cloudflareDatasetSettingsSchema,
    fetchImpl
  );
  if (!settings.enabled) {
    throw new ImportProviderError({
      provider: PROVIDER,
      detail: `${dataset} is not available on this plan`,
    });
  }
  return {
    notOlderThan: settings.notOlderThan,
    maxDuration: settings.maxDuration,
  };
}

/** The first whole UTC day a dataset still holds. */
export function cloudflareEarliestDay(
  limits: CloudflareDatasetLimits,
  now = Date.now()
): string {
  const edge =
    now - limits.notOlderThan * 1000 + CLOUDFLARE_RETENTION_MARGIN_MS;
  return toDay(
    new Date(
      Math.ceil(edge / CLOUDFLARE_DAY_SPLIT_MS) * CLOUDFLARE_DAY_SPLIT_MS
    )
  );
}

function crawlerLimits(
  credentials: CloudflareCredentials,
  zone: string,
  fetchImpl?: ImportFetch
) {
  return datasetLimits(
    credentials,
    "zones",
    zone,
    CLOUDFLARE_CRAWLER_DATASET,
    fetchImpl
  );
}

function rumLimits(
  credentials: CloudflareCredentials,
  account: string,
  fetchImpl?: ImportFetch
) {
  return datasetLimits(
    credentials,
    "accounts",
    account,
    CLOUDFLARE_RUM_DATASET,
    fetchImpl
  );
}

function rumRef(ref: string): { account: string; siteTag: string } {
  const [account = "", siteTag = ""] = ref.split(CLOUDFLARE_RUM_REF_SEPARATOR);
  return { account, siteTag };
}

/** The days a source can still return; Cloudflare keeps them per plan. */
export async function previewCloudflareSource(
  credentials: CloudflareCredentials,
  provider: "cloudflare" | "cloudflare_rum",
  ref: string,
  fetchImpl?: ImportFetch
): Promise<ImportPreview> {
  const limits =
    provider === "cloudflare"
      ? await crawlerLimits(credentials, ref, fetchImpl)
      : await rumLimits(credentials, rumRef(ref).account, fetchImpl);
  return {
    earliestDay: cloudflareEarliestDay(limits),
    pageviews: null,
    pageviewsByMonth: null,
  };
}

/** The part of a chunk the dataset still holds, so an aged-out day is skipped, not failed. */
function retainedRange(
  range: ImportDayRange,
  limits: CloudflareDatasetLimits
): ImportDayRange | null {
  const earliest = cloudflareEarliestDay(limits);
  const start = range.start < earliest ? earliest : range.start;
  return start <= range.end ? { start, end: range.end } : null;
}

/**
 * Reads [from, to) and halves every window that fills Cloudflare's
 * 10,000-row page, on day boundaries and then on hours. `complete` is false
 * when a one-hour window still came back full.
 */
async function readWindows<T>(
  from: number,
  to: number,
  read: (from: number, to: number) => Promise<T[]>
): Promise<{ rows: T[]; complete: boolean }> {
  const rows = await read(from, to);
  if (rows.length < CLOUDFLARE_PAGE_LIMIT) {
    return { rows, complete: true };
  }
  if (to - from <= CLOUDFLARE_MIN_SPLIT_MS) {
    return { rows, complete: false };
  }
  const unit =
    to - from > CLOUDFLARE_DAY_SPLIT_MS
      ? CLOUDFLARE_DAY_SPLIT_MS
      : CLOUDFLARE_MIN_SPLIT_MS;
  const middle = from + Math.floor((to - from) / 2 / unit) * unit;
  const split = middle > from ? middle : from + unit;
  const first = await readWindows(from, split, read);
  const second = await readWindows(split, to, read);
  return {
    rows: [...first.rows, ...second.rows],
    complete: first.complete && second.complete,
  };
}

/**
 * AI crawler hits per UTC day from httpRequestsAdaptiveGroups. Only AI user
 * agents are requested (never IPs or query strings); full days are split
 * into smaller windows when Cloudflare's 10,000-row page fills up. Rows come
 * busiest first, so an hour that still fills the page loses only its rarest.
 */
export async function fetchCloudflareCrawlerChunk(
  credentials: CloudflareCredentials,
  zone: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<GeoImportRecord[]> {
  const crawlerWindow =
    (agents: Record<string, string>[]) => async (from: number, to: number) =>
      await graphql(
        credentials,
        CRAWLER_QUERY,
        {
          zone,
          filter: {
            datetime_geq: new Date(from).toISOString(),
            datetime_lt: new Date(to).toISOString(),
            requestSource: "eyeball",
            clientRequestHTTPMethodName: "GET",
            OR: agents,
          },
        },
        ["viewer", "zones", 0, "httpRequestsAdaptiveGroups"],
        cloudflareCrawlerGroupSchema,
        fetchImpl
      );

  const retained = retainedRange(
    range,
    await crawlerLimits(credentials, zone, fetchImpl)
  );
  const records: GeoImportRecord[] = [];
  const groups = cloudflareUserAgentFilters();
  for (const day of retained ? daysInRange(retained) : []) {
    for (const agents of groups) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one token's 300-per-5-minute budget
      const { rows } = await readWindows(
        dayStartMs(day),
        dayStartMs(addDays(day, 1)),
        crawlerWindow(agents)
      );
      for (const row of rows) {
        records.push({
          day: row.dimensions.date,
          host: row.dimensions.clientRequestHTTPHost,
          path: row.dimensions.clientRequestPath,
          userAgent: row.dimensions.userAgent,
          verified: Boolean(row.dimensions.verifiedBotCategory),
          status: row.dimensions.edgeResponseStatus,
          requests: row.count,
          sampleInterval: row.avg?.sampleInterval ?? 1,
        });
      }
    }
  }
  return records;
}

function rumQuery(dimensions: readonly string[]): string {
  return `query ($account: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: ${CLOUDFLARE_PAGE_LIMIT}, filter: $filter) {
        count
        sum { visits }
        dimensions { date ${dimensions.join(" ")} }
      }
    }
  }
}`;
}

/**
 * Page loads per grain. A page row counts loads only; the same row read as an
 * entry page counts the visits that started there, and is skipped without any.
 */
function rumMetrics(
  grain: ImportWebGrain,
  count: number,
  visits: number
): Partial<WebImportRecord> | null {
  if (grain === "page") {
    return { pageviews: count };
  }
  if (grain === "entry_page") {
    return visits > 0 ? { pageviews: 0, visits, entrances: visits } : null;
  }
  return { pageviews: count, visits };
}

/**
 * Cloudflare Web Analytics (RUM) page loads and visits for a source ref from
 * listCloudflareSources. Sampled, with no unique visitors and no UTM data;
 * bot page loads are excluded. Windows that fill a page are split until
 * complete; rows of one day read in several windows are summed on write.
 */
export async function fetchCloudflareRumChunk(
  credentials: CloudflareCredentials,
  ref: string,
  range: ImportDayRange,
  fetchImpl?: ImportFetch
): Promise<WebImportRecord[]> {
  const { account, siteTag } = rumRef(ref);
  const limits = await rumLimits(credentials, account, fetchImpl);
  const retained = retainedRange(range, limits);
  const windows = retained
    ? importChunks(
        retained,
        Math.max(
          1,
          Math.floor((limits.maxDuration * 1000) / CLOUDFLARE_DAY_SPLIT_MS)
        )
      )
    : [];
  const records: WebImportRecord[] = [];
  for (const query of CLOUDFLARE_RUM_QUERIES) {
    const read = async (from: number, to: number) =>
      await graphql(
        credentials,
        rumQuery(Object.keys(query.dimensions)),
        {
          account,
          filter: {
            siteTag,
            datetime_geq: new Date(from).toISOString(),
            datetime_lt: new Date(to).toISOString(),
            bot: 0,
          },
        },
        ["viewer", "accounts", 0, "rumPageloadEventsAdaptiveGroups"],
        cloudflareRumGroupSchema,
        fetchImpl
      );
    const rows: Awaited<ReturnType<typeof read>> = [];
    let complete = true;
    for (const window of windows) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one token's 300-per-5-minute budget
      const result = await readWindows(
        dayStartMs(window.start),
        dayStartMs(addDays(window.end, 1)),
        read
      );
      rows.push(...result.rows);
      complete &&= result.complete;
    }
    if (!complete) {
      throw new ImportProviderError({
        provider: PROVIDER,
        detail: `more than ${CLOUDFLARE_PAGE_LIMIT} ${Object.values(query.dimensions).join(" and ")} rows in one hour`,
      });
    }
    for (const row of rows) {
      const value = (key: string) => String(row.dimensions[key] ?? "");
      const dimensions = readImportDimensions(query.dimensions, value);
      for (const grain of query.grains) {
        const metrics = rumMetrics(grain, row.count, row.sum?.visits ?? 0);
        if (metrics) {
          records.push({
            grain,
            day: value("date"),
            ...dimensions,
            ...metrics,
          });
        }
      }
    }
  }
  return records;
}
