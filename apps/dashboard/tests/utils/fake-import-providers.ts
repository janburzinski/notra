/**
 * In-process stand-ins for the analytics APIs history imports read:
 * Plausible (Sites API v1 list + Stats API v2 query), Cloudflare (zones,
 * GraphQL settings / httpRequestsAdaptiveGroups) and Vercel (projects v9, Web
 * Analytics aggregate). Shapes, auth and rate-limit answers follow the
 * providers' public docs; Vercel's follow answers captured from its live
 * API. Every answer is computed from one synthetic session log, so a test
 * can check imported totals against the source.
 *
 * Tests reach them by routing fetch (`routeProviderFetch`); the importers'
 * fixed provider hosts never become configurable.
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const DAY_MS = 86_400_000;
const PLAUSIBLE_SESSION_METRICS = new Set([
  "bounce_rate",
  "visit_duration",
  "views_per_visit",
]);

interface FakeSession {
  day: string;
  visitor: string;
  host: string;
  pages: string[];
  source: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  country: string;
  device: string;
  browser: string;
  os: string;
  durationS: number;
}

interface FakeCrawlerHit {
  day: string;
  hour: number;
  host: string;
  path: string;
  userAgent: string;
  verifiedBotCategory: string;
  status: number;
  count: number;
}

interface FakeDataset {
  sessions: FakeSession[];
  crawlerHits: FakeCrawlerHit[];
}

interface FakeProviderOptions {
  dataset: FakeDataset;
  host: string;
  plausibleKey: string;
  cloudflareToken: string;
  zoneId: string;
  cloudflareSampleInterval: number;
  /** How far back the plan keeps crawler data, in seconds. */
  crawlerNotOlderThan: number;
  vercelToken: string;
  vercelTeamId: string;
  vercelProjectId: string;
  /** Days of Web Analytics history the Vercel plan keeps (Pro: 366). */
  vercelRetentionDays: number;
}

type FakeProviderName = "plausible" | "cloudflare" | "vercel";

type Row = Record<string, string | number>;

/** A small linear congruential generator, so every run sees the same data. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * A deterministic session log for `host` (plus a docs subdomain and an old
 * domain) and AI crawler hits, including humans, a vulnerability scanner and
 * query strings the importers must drop.
 */
export function createFakeDataset(input: {
  host: string;
  start: string;
  end: string;
}): FakeDataset {
  const random = seededRandom(7);
  const pick = <T>(values: readonly T[]): T =>
    values[Math.floor(random() * values.length)] as T;
  const sources = [
    { source: "Direct / None", referrer: "", utm: ["", "", "", "", ""] },
    { source: "Google", referrer: "www.google.com", utm: ["", "", "", "", ""] },
    { source: "ChatGPT", referrer: "chatgpt.com", utm: ["", "", "", "", ""] },
    {
      source: "Newsletter",
      referrer: "",
      utm: ["newsletter", "email", "Spring Launch", "launch", "hero"],
    },
  ] as const;
  const pages = ["/", "/pricing", "/blog/launch?utm_source=x", "/docs"];
  const sessions: FakeSession[] = [];
  const crawlerHits: FakeCrawlerHit[] = [];
  for (let day = input.start; day <= input.end; day = addDays(day, 1)) {
    const count = 6 + Math.floor(random() * 6);
    for (let index = 0; index < count; index += 1) {
      const origin = pick(sources);
      const length = 1 + Math.floor(random() * 3);
      sessions.push({
        day,
        visitor: `v${Math.floor(random() * 12)}`,
        host: random() < 0.15 ? `docs.${input.host}` : input.host,
        pages: Array.from({ length }, () => pick(pages)),
        source: origin.source,
        referrer: origin.referrer,
        utmSource: origin.utm[0],
        utmMedium: origin.utm[1],
        utmCampaign: origin.utm[2],
        utmTerm: origin.utm[3],
        utmContent: origin.utm[4],
        country: pick(["US", "DE", "GB"]),
        device: pick(["Desktop", "Mobile", "Tablet"]),
        browser: pick(["Chrome", "Safari", "Firefox"]),
        os: pick(["Mac", "Windows", "iOS", "Android"]),
        durationS: length === 1 ? 0 : 20 + Math.floor(random() * 200),
      });
    }
    for (const [userAgent, verified] of [
      [
        "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
        "AI Crawler",
      ],
      [
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
        "AI Crawler",
      ],
      [
        "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
        "",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
        "",
      ],
    ] as const) {
      crawlerHits.push({
        day,
        hour: Math.floor(random() * 24),
        host: input.host,
        path: pick(["/", "/pricing", "/docs", "/wp-login.php"]),
        userAgent,
        verifiedBotCategory: verified,
        status: pick([200, 200, 404]),
        count: 1 + Math.floor(random() * 20),
      });
    }
  }
  sessions.push({
    ...(sessions[0] as FakeSession),
    host: "old-domain.example",
    visitor: "moved",
  });
  return { sessions, crawlerHits };
}

function pageviewEvents(sessions: readonly FakeSession[]) {
  return sessions.flatMap((session, sessionIndex) =>
    session.pages.map((page) => ({ session, sessionIndex, page }))
  );
}

function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return groups;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function bearer(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
}

/** visit:utm_source reads session.utmSource, and so on. */
function plausibleVisitValue(session: FakeSession, dimension: string): string {
  if (dimension === "visit:entry_page") {
    return session.pages[0] ?? "";
  }
  if (dimension === "visit:entry_page_hostname") {
    return session.host;
  }
  if (dimension === "time:month") {
    return `${session.day.slice(0, 7)}-01`;
  }
  const field = dimension
    .replace(/^(visit|time):/, "")
    .replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase());
  const value = session[field as keyof FakeSession];
  if (typeof value !== "string") {
    throw new Error(`unsupported dimension ${dimension}`);
  }
  return value;
}

interface PlausibleQuery {
  site_id: string;
  metrics: string[];
  date_range: string | [string, string];
  dimensions?: string[];
  include?: { total_rows?: boolean };
  pagination?: { limit?: number; offset?: number };
}

/** Plausible Stats API v2 over the session log. */
function plausibleQuery(
  sessions: readonly FakeSession[],
  query: PlausibleQuery
): Response {
  const dimensions = query.dimensions ?? [];
  const eventDimensions = dimensions.filter((name) =>
    name.startsWith("event:")
  );
  const onlyPageDimensions = eventDimensions.every(
    (name) => name === "event:page" || name === "event:hostname"
  );
  if (
    eventDimensions.length > 0 &&
    !onlyPageDimensions &&
    query.metrics.some((name) => PLAUSIBLE_SESSION_METRICS.has(name))
  ) {
    return json(
      {
        error:
          "Session metric(s) cannot be queried along with event dimension(s)",
      },
      400
    );
  }
  const [from, to] =
    query.date_range === "all"
      ? ["0000-01-01", "9999-12-31"]
      : (query.date_range as [string, string]);
  const inRange = sessions.filter(
    (session) => session.day >= from && session.day <= to
  );
  const results: { dimensions: (string | number)[]; metrics: number[] }[] = [];
  if (eventDimensions.length > 0) {
    const events = pageviewEvents(inRange);
    const groups = groupBy(events, (event) =>
      JSON.stringify(
        dimensions.map((name) => {
          if (name === "event:page") {
            return event.page.split("?")[0];
          }
          if (name === "event:hostname") {
            return event.session.host;
          }
          return plausibleVisitValue(event.session, name);
        })
      )
    );
    for (const [key, group] of groups) {
      const metrics: Record<string, number> = {
        visitors: new Set(group.map((event) => event.session.visitor)).size,
        visits: new Set(group.map((event) => event.sessionIndex)).size,
        pageviews: group.length,
      };
      results.push({
        dimensions: JSON.parse(key),
        metrics: query.metrics.map((name) => metrics[name] ?? 0),
      });
    }
  } else {
    const groups = groupBy(inRange, (session) =>
      JSON.stringify(
        dimensions.map((name) => plausibleVisitValue(session, name))
      )
    );
    for (const [key, group] of groups) {
      const visits = group.length;
      const metrics: Record<string, number> = {
        visitors: new Set(group.map((session) => session.visitor)).size,
        visits,
        pageviews: group.reduce(
          (sum, session) => sum + session.pages.length,
          0
        ),
        bounce_rate: Math.round(
          (group.filter((session) => session.pages.length === 1).length /
            visits) *
            100
        ),
        visit_duration: Math.round(
          group.reduce((sum, session) => sum + session.durationS, 0) / visits
        ),
      };
      results.push({
        dimensions: JSON.parse(key),
        metrics: query.metrics.map((name) => metrics[name] ?? 0),
      });
    }
  }
  results.sort((a, b) =>
    JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions))
  );
  const limit = query.pagination?.limit ?? 10_000;
  const offset = query.pagination?.offset ?? 0;
  return json({
    results: results.slice(offset, offset + limit),
    meta: query.include?.total_rows ? { total_rows: results.length } : {},
    query,
  });
}

function matchesAgent(userAgent: string, filters: Row[]): boolean {
  return filters.some((filter) =>
    "userAgent" in filter
      ? filter.userAgent === userAgent
      : userAgent.includes(String(filter.userAgent_like).replaceAll("%", ""))
  );
}

const VERCEL_DIMENSIONS: Record<string, (session: FakeSession) => string> = {
  country: (session) => session.country,
  deviceType: (session) => session.device.toLowerCase(),
  browserName: (session) => session.browser,
  osName: (session) => session.os,
  referrerHostname: (session) => session.referrer.replace(/^www\./, ""),
  utmSource: (session) => session.utmSource,
};
const VERCEL_TIME_GRAINS = new Set(["day", "month"]);
const VERCEL_OTHERS = "Others";

function vercelError(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status);
}

type FakeEvent = ReturnType<typeof pageviewEvents>[number];

/** Bucket keys of a time grain from `from` through `until`, empty ones included. */
function vercelBuckets(grain: string, from: string, until: string): string[] {
  const buckets: string[] = [];
  for (let day = from; day <= until; day = addDays(day, 1)) {
    if (grain === "day" || day.endsWith("-01") || day === from) {
      buckets.push(`${day}T00:00:00.000Z`);
    }
  }
  return buckets;
}

/**
 * Vercel's Web Analytics aggregate over the session log, as the live API
 * answers: buckets snap to the grain, time buckets include empty ones,
 * visitors are unique per day and summed, and values past `limit` fold into
 * one "Others" row. `by=day&by=<dimension>` ranks values over the whole
 * range and answers every day of each of the top `limit` values, zeros
 * included; how it folds the rest was never seen live (the capture had fewer
 * values than the limit), so here they become an "Others" row per day.
 */
function vercelAggregate(
  sessions: readonly FakeSession[],
  url: URL,
  retentionDays: number
): Response {
  const by = url.searchParams.getAll("by");
  const limit = Number(url.searchParams.get("limit") ?? 100);
  if (by.length === 0) {
    return vercelError(
      "bad_request",
      "Invalid request: missing required property `by`.",
      400
    );
  }
  const grains = by.filter((name) => VERCEL_TIME_GRAINS.has(name));
  const dimensions = by.filter((name) => !VERCEL_TIME_GRAINS.has(name));
  const [grain] = grains;
  const [dimension] = dimensions;
  if (grains.length > 1 || dimensions.length > 1) {
    return vercelError("bad_request", "Invalid request: `by`.", 400);
  }
  if (limit > 100) {
    return vercelError(
      "bad_request",
      "Invalid request: `limit` should be <= 100.",
      400
    );
  }
  if (dimension?.startsWith("utm")) {
    return vercelError(
      "payment_required",
      "UTM dimensions require an Enterprise plan or the Web Analytics Plus add-on.",
      402
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const since = String(url.searchParams.get("since")).slice(0, 10);
  const until = String(url.searchParams.get("until")).slice(0, 10);
  if (since < addDays(today, -(retentionDays - 1))) {
    return vercelError(
      "bad_request",
      `Invalid request: the pro plan only grants access to the latest ${retentionDays} days of data.`,
      400
    );
  }
  const from = grain === "month" ? `${since.slice(0, 7)}-01` : since;
  const events = pageviewEvents(
    sessions.filter((session) => session.day >= from && session.day <= until)
  );
  const bucketOf = (event: FakeEvent) => {
    const day = event.session.day;
    return `${grain === "month" ? `${day.slice(0, 7)}-01` : day}T00:00:00.000Z`;
  };
  const valueOf = (event: FakeEvent) => {
    if (dimension === "requestPath") {
      return event.page.split("?")[0] ?? "/";
    }
    return VERCEL_DIMENSIONS[dimension ?? ""]?.(event.session) ?? "";
  };
  const measure = (group: readonly FakeEvent[]) => ({
    pageviews: group.length,
    visitors: [...groupBy(group, (event) => event.session.day).values()].reduce(
      (sum, day) =>
        sum + new Set(day.map((event) => event.session.visitor)).size,
      0
    ),
  });
  const ranked = [...groupBy(events, valueOf).entries()].toSorted(
    (a, b) => b[1].length - a[1].length
  );
  const top = ranked.slice(0, limit);
  const rest = ranked.slice(limit).flatMap(([, group]) => group);
  if (!grain) {
    const data = top.map(([value, group]) => ({
      [dimension ?? ""]: value,
      ...measure(group),
    }));
    if (rest.length > 0) {
      data.push({ [dimension ?? ""]: VERCEL_OTHERS, ...measure(rest) });
    }
    return json({ version: 1, data });
  }
  const buckets = vercelBuckets(grain, from, until);
  const series = (group: readonly FakeEvent[]) => {
    const byBucket = groupBy(group, bucketOf);
    return buckets.map((timestamp) => ({
      timestamp,
      ...measure(byBucket.get(timestamp) ?? []),
    }));
  };
  if (!dimension) {
    return json({ version: 1, data: series(events) });
  }
  const groups: [string, FakeEvent[]][] =
    rest.length > 0 ? [...top, [VERCEL_OTHERS, rest]] : top;
  return json({
    version: 1,
    data: groups.flatMap(([value, group]) =>
      series(group).map((row) => ({ ...row, [dimension]: value }))
    ),
  });
}

function cloudflareGraphqlError(message: string, status = 200) {
  return json({ data: null, errors: [{ message, path: null }] }, status);
}

interface FakeProviders {
  url: string;
  options: FakeProviderOptions;
  faults: {
    /** Queued 429 answers for the next Plausible requests. */
    plausible429: number;
    /** Queued 429 answers for the next Vercel requests. */
    vercel429: number;
    /** Runs before each provider request, for example to revoke a key. */
    beforeRequest?: () => void;
  };
  stop: () => void;
}

export async function startFakeProviders(
  options: FakeProviderOptions
): Promise<FakeProviders> {
  const faults: FakeProviders["faults"] = { plausible429: 0, vercel429: 0 };
  const { dataset } = options;

  async function plausible(request: Request, path: string) {
    if (bearer(request) !== options.plausibleKey) {
      return json({ error: "Invalid API key or site ID." }, 401);
    }
    if (faults.plausible429 > 0) {
      faults.plausible429 -= 1;
      return json({ error: "Too many API requests in the last hour." }, 429);
    }
    if (path === "/api/v1/sites" && request.method === "GET") {
      return json({
        sites: [{ domain: options.host, timezone: "Etc/UTC" }],
        meta: { after: null, before: null, limit: 100 },
      });
    }
    if (path === "/api/v2/query" && request.method === "POST") {
      const query = (await request.json()) as PlausibleQuery;
      if (query.site_id !== options.host) {
        return json({ error: `Site not found: ${query.site_id}` }, 400);
      }
      return plausibleQuery(dataset.sessions, query);
    }
    return json({ error: "Not found" }, 404);
  }

  async function cloudflare(request: Request, path: string) {
    if (bearer(request) !== options.cloudflareToken) {
      const errors = [{ code: 10_000, message: "Authentication error" }];
      return json({ success: false, errors, messages: [], result: null }, 403);
    }
    if (path === "/client/v4/zones") {
      // A zone without an account, so no Web Analytics sites are listed.
      return json({
        success: true,
        errors: [],
        messages: [],
        result: [{ id: options.zoneId, name: options.host }],
        result_info: {
          page: 1,
          per_page: 50,
          count: 1,
          total_count: 1,
          total_pages: 1,
        },
      });
    }
    if (path !== "/client/v4/graphql" || request.method !== "POST") {
      return json({ success: false, errors: [{ code: 7003 }] }, 404);
    }
    const body = (await request.json()) as {
      query: string;
      variables: Record<string, unknown>;
    };
    if (body.query.includes("settings")) {
      if (String(body.variables.tag) !== options.zoneId) {
        return cloudflareGraphqlError("not authorized for that zone");
      }
      return json({
        data: {
          viewer: {
            zones: [
              {
                settings: {
                  httpRequestsAdaptiveGroups: {
                    enabled: true,
                    notOlderThan: options.crawlerNotOlderThan,
                    maxDuration: 86_400,
                  },
                },
              },
            ],
          },
        },
        errors: null,
      });
    }
    const filter = body.variables.filter as Row & { OR?: Row[] };
    const from = Date.parse(String(filter.datetime_geq));
    const to = Date.parse(String(filter.datetime_lt));
    if (from < Date.now() - options.crawlerNotOlderThan * 1000) {
      return cloudflareGraphqlError(
        `cannot request data older than ${options.crawlerNotOlderThan}s`,
        400
      );
    }
    if (to - from > DAY_MS) {
      return cloudflareGraphqlError(
        "query time range is too large, max 86400s",
        400
      );
    }
    if (body.variables.zone !== options.zoneId) {
      return cloudflareGraphqlError("not authorized for that zone");
    }
    const limit = Number(/limit:\s*(\d+)/.exec(body.query)?.[1] ?? 10_000);
    const hits = dataset.crawlerHits.filter((hit) => {
      const at = Date.parse(`${hit.day}T00:00:00Z`) + hit.hour * 3_600_000;
      return (
        at >= from &&
        at < to &&
        filter.requestSource === "eyeball" &&
        matchesAgent(hit.userAgent, filter.OR ?? [])
      );
    });
    const groups = groupBy(hits, (hit) =>
      JSON.stringify([
        hit.day,
        hit.host,
        hit.path,
        hit.userAgent,
        hit.verifiedBotCategory,
        hit.status,
      ])
    );
    const rows = [...groups.values()]
      .map((group) => {
        const first = group[0] as FakeCrawlerHit;
        return {
          count: group.reduce((sum, hit) => sum + hit.count, 0),
          avg: { sampleInterval: options.cloudflareSampleInterval },
          dimensions: {
            date: first.day,
            clientRequestHTTPHost: first.host,
            clientRequestPath: first.path,
            userAgent: first.userAgent,
            verifiedBotCategory: first.verifiedBotCategory,
            edgeResponseStatus: first.status,
          },
        };
      })
      .toSorted((a, b) => b.count - a.count)
      .slice(0, limit);
    return json({
      data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: rows }] } },
      errors: null,
    });
  }

  /** Vercel's REST API: a user token scoped to a team with ?teamId. */
  function vercel(request: Request, path: string, url: URL) {
    if (bearer(request) !== options.vercelToken) {
      return vercelError("forbidden", "Not authorized", 403);
    }
    if (url.searchParams.get("teamId") !== options.vercelTeamId) {
      return vercelError(
        "forbidden",
        "You don't have permission to access this team.",
        403
      );
    }
    const limits = {
      "x-ratelimit-limit": "400",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
    };
    if (faults.vercel429 > 0) {
      faults.vercel429 -= 1;
      return new Response(
        JSON.stringify({
          error: { code: "too_many_requests", message: "Rate limit exceeded" },
        }),
        { status: 429, headers: { ...limits, "x-ratelimit-remaining": "0" } }
      );
    }
    if (path === "/v9/projects") {
      return json({
        projects: [
          {
            id: options.vercelProjectId,
            name: "site",
            targets: {
              production: {
                alias: [options.host, "site-team.vercel.app"],
              },
            },
          },
        ],
        pagination: { count: 1, next: null, prev: null },
      });
    }
    if (path !== "/v1/query/web-analytics/visits/aggregate") {
      return vercelError("not_found", "Not found", 404);
    }
    if (url.searchParams.get("projectId") !== options.vercelProjectId) {
      return vercelError("not_found", "Project not found", 404);
    }
    if (url.searchParams.get("filter") !== "environment eq 'production'") {
      return vercelError("bad_request", "Expected the production filter", 400);
    }
    const response = vercelAggregate(
      dataset.sessions,
      url,
      options.vercelRetentionDays
    );
    for (const [name, value] of Object.entries(limits)) {
      response.headers.set(name, value);
    }
    return response;
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, provider = "", ...rest] = url.pathname.split("/");
    const path = `/${rest.join("/")}`;
    if (!["plausible", "cloudflare", "vercel"].includes(provider)) {
      return json({ error: "unknown provider" }, 404);
    }
    faults.beforeRequest?.();
    if (provider === "plausible") {
      return await plausible(request, path);
    }
    if (provider === "vercel") {
      return vercel(request, path, url);
    }
    return await cloudflare(request, path);
  }

  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", async () => {
      const body = Buffer.concat(chunks);
      const response = await handle(
        new Request(`http://127.0.0.1${incoming.url ?? "/"}`, {
          method: incoming.method,
          headers: incoming.headers as Record<string, string>,
          ...(body.length > 0 ? { body } : {}),
        })
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    options,
    faults,
    stop: () => server.close(),
  };
}

const PROVIDER_ORIGINS: Record<string, FakeProviderName> = {
  "https://plausible.io": "plausible",
  "https://api.cloudflare.com": "cloudflare",
  "https://api.vercel.com": "vercel",
};

/** fetch that sends the real provider hosts to the fakes and anything else through. */
export function routeProviderFetch(
  fakes: Pick<FakeProviders, "url">,
  passThrough: typeof fetch = fetch
): typeof fetch {
  const route = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const provider = PROVIDER_ORIGINS[url.origin];
    if (!provider) {
      return passThrough(input, init);
    }
    return passThrough(
      `${fakes.url}/${provider}${url.pathname}${url.search}`,
      init
    );
  };
  return Object.assign(route, { preconnect: () => undefined }) as typeof fetch;
}

/** Day totals the source holds, for comparing with what an import wrote. */
export function expectedWebTotals(
  dataset: FakeDataset,
  input: { start: string; end: string }
) {
  const sessions = dataset.sessions.filter(
    (session) => session.day >= input.start && session.day <= input.end
  );
  const byDay = groupBy(sessions, (session) => session.day);
  let pageviews = 0;
  let visits = 0;
  let visitors = 0;
  for (const group of byDay.values()) {
    pageviews += group.reduce((sum, session) => sum + session.pages.length, 0);
    visits += group.length;
    visitors += new Set(group.map((session) => session.visitor)).size;
  }
  return { pageviews, visits, visitors, days: byDay.size };
}
