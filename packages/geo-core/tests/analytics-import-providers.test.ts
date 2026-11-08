import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { strToU8, Zip, ZipDeflate, zipSync } from "fflate";

import {
  IMPORT_PROVIDERS,
  IMPORT_RATE_LIMITS,
  CLOUDFLARE_RUM_CHUNK_DAYS,
  VERCEL_CHUNK_DAYS,
} from "../src/constants/analytics-imports";
import {
  cloudflareEarliestDay,
  cloudflareUserAgentFilters,
  fetchCloudflareCrawlerChunk,
  fetchCloudflareRumChunk,
  listCloudflareSources,
  previewCloudflareSource,
} from "../src/imports/cloudflare";
import { rateLimitWaitSeconds, retryAfterSeconds } from "../src/imports/http";
import {
  fetchPlausibleChunk,
  listPlausibleSites,
  previewPlausibleSite,
} from "../src/imports/plausible-api";
import {
  bytesToChunks,
  parsePlausibleCsvZip,
} from "../src/imports/plausible-csv";
import {
  aggregateGeoRows,
  aggregateWebRows,
  toGeoImportedRow,
  toWebImportedRow,
} from "../src/imports/rows";
import {
  fetchVercelChunk,
  listVercelProjects,
  previewVercelProject,
} from "../src/imports/vercel";
import {
  ImportAuthError,
  ImportFileError,
  ImportProviderError,
  ImportRateLimitedError,
} from "../src/schemas/analytics-import-errors";
import type {
  ImportFetch,
  ImportRowContext,
  WebImportRecord,
} from "../src/types/analytics-imports";
import { addDays, toDay } from "../src/utils/analytics-import-range";

const FIXTURES = fileURLToPath(
  new URL("fixtures/plausible-export", import.meta.url)
);

const CONTEXT: ImportRowContext = {
  organizationId: "org",
  projectId: "project",
  siteId: "",
  importId: "imp",
  provider: "plausible_csv",
  host: "example.com",
  importedAt: "2026-11-04 00:00:00",
};
const PLAUSIBLE = { apiKey: "key-1234567890" };
const CLOUDFLARE = { apiToken: "token-12345678901234567890" };
const VERCEL = { token: "vercel-token-1", teamId: "team_abc" };
const DAY = 86_400;

interface Call {
  url: URL;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
}

function fakeFetch(
  respond: (call: Call) => Response | Record<string, unknown>
): { fetch: ImportFetch; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (input, init) => {
      const call: Call = {
        url: new URL(String(input)),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
      calls.push(call);
      const result = respond(call);
      return result instanceof Response ? result : Response.json(result);
    },
  };
}

/** Answers Cloudflare's GraphQL settings node, then hands other calls on. */
function withSettings(
  respond: (call: Call) => Response | Record<string, unknown>,
  limits = { notOlderThan: 3650 * DAY, maxDuration: 3650 * DAY, enabled: true }
) {
  return (call: Call) => {
    const query = String(call.body?.query ?? "");
    if (!query.includes("settings")) {
      return respond(call);
    }
    const scope = query.includes("zones(") ? "zones" : "accounts";
    const dataset =
      scope === "zones"
        ? "httpRequestsAdaptiveGroups"
        : "rumPageloadEventsAdaptiveGroups";
    return {
      data: { viewer: { [scope]: [{ settings: { [dataset]: limits } }] } },
    };
  };
}

const isData = (call: Call) =>
  !String(call.body?.query ?? "").includes("settings");
const queryWindow = (call: Call) => {
  const { filter } = (call.body?.variables ?? {}) as {
    filter: Record<string, string>;
  };
  return [filter.datetime_geq, filter.datetime_lt];
};
const zonePage = (rows: Record<string, unknown>[]) => ({
  data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: rows }] } },
});
const rumPage = (rows: Record<string, unknown>[]) => ({
  data: {
    viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows }] },
  },
});
const crawlerRow = (
  path: string,
  userAgent: string,
  verified: string,
  count = 10
) => ({
  count,
  avg: { sampleInterval: 10 },
  dimensions: {
    date: "2026-10-01",
    clientRequestHTTPHost: "example.com",
    clientRequestPath: path,
    userAgent,
    verifiedBotCategory: verified,
    edgeResponseStatus: 200,
  },
});

function exportZip(extra: Record<string, Uint8Array> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const name of readdirSync(FIXTURES)) {
    files[name] = readFileSync(join(FIXTURES, name));
  }
  return zipSync({ ...files, ...extra });
}

async function* oneChunk(bytes: Uint8Array) {
  yield bytes;
}

describe("Plausible CSV export", () => {
  test("streams every table into records and summarizes the range", async () => {
    const records: WebImportRecord[] = [];
    const summary = await parsePlausibleCsvZip(
      bytesToChunks(exportZip(), 512),
      (batch) => {
        records.push(...batch);
      }
    );
    expect(summary).toMatchObject({
      firstDay: "2026-08-01",
      lastDay: "2026-09-30",
      pageviews: 304 + 325 + 233 + 2681 + 3075,
    });
    expect(summary.pageviewsByDay["2026-08-01"]).toBe(304);
    expect(summary.files).toHaveLength(8);
    expect(
      [...new Set(records.map((record) => record.grain))].toSorted()
    ).toEqual([
      "browser",
      "country",
      "device",
      "entry_page",
      "os",
      "page",
      "source",
      "total",
    ]);
    expect(
      records.find((record) => record.grain === "entry_page")
    ).toMatchObject({
      path: "/",
      visits: 100,
      entrances: 100,
      bounces: 55,
      visitDurationS: 15_000,
    });
  });

  test("a whole export in one chunk maps to rows without query strings or regions, with sources classified", async () => {
    const records: WebImportRecord[] = [];
    await parsePlausibleCsvZip(oneChunk(exportZip()), (batch) => {
      records.push(...batch);
    });
    const rows = aggregateWebRows(
      records.map((record) => toWebImportedRow(record, CONTEXT))
    );
    const find = (match: (row: (typeof rows)[number]) => boolean) =>
      rows.filter(match);
    expect(
      find((row) => row.grain === "page" && row.path === "/blog/hello-world")
    ).toEqual([expect.objectContaining({ pageviews: 94, visitors: 43 })]);
    expect(
      find((row) => row.grain === "country" && row.country === "DE")
    ).toEqual([expect.objectContaining({ visitors: 80, pageviews: 204 })]);
    expect(JSON.stringify(rows)).not.toContain("DE-BE");
    const chatgpt = find(
      (row) =>
        row.grain === "source" &&
        row.day === "2026-08-01" &&
        row.referrer_source === "chatgpt"
    );
    expect(chatgpt.map((row) => row.utm_source).toSorted()).toEqual([
      "",
      "chatgpt.com",
    ]);
    for (const row of chatgpt) {
      expect(row).toMatchObject({ referrer_group: "ai", ai_product: "openai" });
    }
    expect(chatgpt.reduce((sum, row) => sum + (row.visitors ?? 0), 0)).toBe(15);
  });

  const VISITORS_HEADER =
    '"date","visitors","pageviews","bounces","visits","visit_duration"\n';
  const VISITORS_FILE = "imported_visitors_20260801_20260801.csv";
  const rejection = async (chunks: AsyncIterable<Uint8Array>) => {
    let written = 0;
    const error = await parsePlausibleCsvZip(chunks, (batch) => {
      written += batch.length;
    }).catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(ImportFileError);
    return { detail: (error as ImportFileError).detail, written };
  };

  test.each([
    [
      "a file with missing columns",
      exportZip({
        "imported_devices_20260801_20260930.csv": strToU8(
          '"date","device","visitors"\n"2026-08-01","Desktop",1\n'
        ),
      }),
    ],
    ["an unknown file", zipSync({ "users.csv": strToU8("email\na@b.c\n") })],
    [
      "a non-numeric count",
      zipSync({
        [VISITORS_FILE]: strToU8(
          `${VISITORS_HEADER}"2026-08-01",1,many,0,1,0\n`
        ),
      }),
    ],
    ["something that is not a ZIP", strToU8("not a zip")],
  ])("rejects %s", async (_label, zip) => {
    await rejection(bytesToChunks(zip));
  });

  const bombCsv = () =>
    strToU8(VISITORS_HEADER + '"2026-08-01",1,1,0,1,0\n'.repeat(120_000));
  const undeclaredZip = () => {
    const parts: Uint8Array[] = [];
    const zip = new Zip((_error, data) => {
      parts.push(data);
    });
    const entry = new ZipDeflate(VISITORS_FILE, { level: 9 });
    zip.add(entry);
    entry.push(bombCsv(), true);
    zip.end();
    return new Uint8Array(Buffer.concat(parts));
  };

  test.each([
    ["declares", () => bytesToChunks(zipSync({ [VISITORS_FILE]: bombCsv() }))],
    ["inflates to", () => oneChunk(undeclaredZip())],
  ])(
    "an entry that %s a bomb-like ratio is refused before writing",
    async (_label, chunks) => {
      expect(await rejection(chunks())).toEqual({
        detail: "compressed too far",
        written: 0,
      });
    }
  );

  test("an export with more than 32 files is refused", async () => {
    const files: Record<string, Uint8Array> = {};
    for (let day = 1; day <= 33; day += 1) {
      files[`imported_visitors_20260801_${String(day).padStart(8, "0")}.csv`] =
        strToU8(VISITORS_HEADER);
    }
    const { detail } = await rejection(bytesToChunks(zipSync(files)));
    expect(detail).toBe("more than 32 files");
  });

  test.each([
    ["a 4 KB field", `"2026-08-01",1,1,0,1,"${"9".repeat(4097)}"\n`],
    ["65 cells", `"2026-08-01"${",1".repeat(64)}\n`],
    ["a 16 KB row", `"2026-08-01"${`,"${"1".repeat(4000)}"`.repeat(5)}\n`],
    ["an unterminated quote", `"2026-08-01,${"1".repeat(5000)}`],
  ])("CSV rows with %s are refused", async (_label, row) => {
    const zip = zipSync({ [VISITORS_FILE]: strToU8(VISITORS_HEADER + row) });
    const { detail } = await rejection(bytesToChunks(zip));
    expect(detail).toMatch(/^line 2: a (field|row) (is longer|has more)/);
  });
});

describe("Plausible Stats API", () => {
  test("lists sites with the bearer key and follows the cursor", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.searchParams.get("after")
        ? { sites: [{ domain: "two.example" }], meta: { after: null } }
        : { sites: [{ domain: "one.example" }], meta: { after: "cursor" } }
    );
    const sites = await listPlausibleSites(PLAUSIBLE, fetch);
    expect(sites.map((site) => site.ref)).toEqual([
      "one.example",
      "two.example",
    ]);
    expect(calls[0]?.headers.get("authorization")).toBe(
      "Bearer key-1234567890"
    );
    expect(calls[0]?.url.pathname).toBe("/api/v1/sites");
  });

  test("previews the first month with page views", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      results: [
        { dimensions: ["2023-01-01"], metrics: [0] },
        { dimensions: ["2023-02-01"], metrics: [120] },
        { dimensions: ["2023-03-01"], metrics: [80] },
      ],
    }));
    expect(await previewPlausibleSite(PLAUSIBLE, "example.com", fetch)).toEqual(
      {
        earliestDay: "2023-02-01",
        pageviews: 200,
        pageviewsByMonth: { "2023-01": 0, "2023-02": 120, "2023-03": 80 },
      }
    );
    expect(calls[0]?.body).toMatchObject({
      date_range: "all",
      dimensions: ["time:month"],
    });
  });

  test("pages through every grain and converts averages to totals", async () => {
    const { fetch, calls } = fakeFetch((call) => {
      const body = call.body as {
        dimensions: string[];
        pagination: { offset: number; limit: number };
      };
      if (body.dimensions.includes("event:page")) {
        const { offset, limit } = body.pagination;
        return {
          results: Array.from({ length: offset === 0 ? limit : 1 }, (_, i) => ({
            dimensions: ["2026-01-02", "example.com", `/p/${offset + i}?q=1`],
            metrics: [1, 1, 2],
          })),
          meta: { total_rows: limit + 1 },
        };
      }
      const totals: Record<string, unknown[]> = {
        "time:day": [
          { dimensions: ["2026-01-02"], metrics: [30, 40, 100, 25, 30] },
        ],
        // One visit counted under both hosts: per-host visitors overlap.
        "time:day,visit:entry_page_hostname": [
          {
            dimensions: ["2026-01-02", "www.example.com"],
            metrics: [21, 20, 50, 25, 30],
          },
          {
            dimensions: ["2026-01-02", "blog.example.com"],
            metrics: [10, 20, 50, 25, 30],
          },
        ],
      };
      const results = totals[body.dimensions.join()] ?? [];
      return { results, meta: { total_rows: results.length } };
    });
    const records = await fetchPlausibleChunk(
      PLAUSIBLE,
      "example.com",
      { start: "2026-01-01", end: "2026-01-31" },
      fetch
    );
    expect(records.filter((record) => record.grain === "page")).toHaveLength(
      10_001
    );
    // A subdomain gets its share of the day; the site keeps the rest, so the
    // rows still add up to the site's exact total.
    expect(records.filter((record) => record.grain === "total")).toEqual([
      {
        grain: "total",
        day: "2026-01-02",
        visitors: 20,
        visits: 20,
        pageviews: 50,
        bounces: 5,
        visitDurationS: 600,
      },
      {
        grain: "total",
        day: "2026-01-02",
        host: "blog.example.com",
        visitors: 10,
        visits: 20,
        pageviews: 50,
        bounces: 5,
        visitDurationS: 600,
      },
    ]);
    expect(calls).toHaveLength(10);
    for (const call of calls) {
      expect(call.body).toMatchObject({
        site_id: "example.com",
        date_range: ["2026-01-01", "2026-01-31"],
        include: { total_rows: true },
      });
    }
  });

  test("a visitor on two subdomains still counts once in the day's totals", async () => {
    const { fetch } = fakeFetch((call) => {
      const body = call.body as { dimensions: string[] };
      const totals: Record<string, unknown[]> = {
        "time:day": [{ dimensions: ["2026-01-02"], metrics: [1, 2, 2, 0, 0] }],
        "time:day,visit:entry_page_hostname": [
          {
            dimensions: ["2026-01-02", "blog.example.com"],
            metrics: [1, 1, 1, 0, 0],
          },
          {
            dimensions: ["2026-01-02", "docs.example.com"],
            metrics: [1, 1, 1, 0, 0],
          },
        ],
      };
      const results = totals[body.dimensions.join()] ?? [];
      return { results, meta: { total_rows: results.length } };
    });
    const rows = (
      await fetchPlausibleChunk(
        PLAUSIBLE,
        "example.com",
        { start: "2026-01-02", end: "2026-01-02" },
        fetch
      )
    ).filter((record) => record.grain === "total");
    const sum = (metric: "visitors" | "visits" | "pageviews") =>
      rows.reduce((total, row) => total + (row[metric] ?? 0), 0);
    expect([sum("visitors"), sum("visits"), sum("pageviews")]).toEqual([
      1, 2, 2,
    ]);
    expect(rows.every((row) => (row.visitors ?? 0) >= 0)).toBe(true);
    expect(rows.find((row) => row.host === "blog.example.com")?.visits).toBe(1);
  });

  test("429 becomes a rate-limit error carrying Retry-After, 401 a reauth error", async () => {
    const limited = fakeFetch(
      () =>
        new Response("slow down", {
          status: 429,
          headers: { "Retry-After": "120" },
        })
    );
    const error = await fetchPlausibleChunk(
      PLAUSIBLE,
      "example.com",
      { start: "2026-01-01", end: "2026-01-31" },
      limited.fetch
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImportRateLimitedError);
    expect((error as ImportRateLimitedError).retryAfterSeconds).toBe(120);
    const denied = fakeFetch(() => new Response("no", { status: 401 }));
    await expect(
      listPlausibleSites(PLAUSIBLE, denied.fetch)
    ).rejects.toBeInstanceOf(ImportAuthError);
  });
});

describe("rate limits", () => {
  test("a 429 waits for Retry-After (seconds or date), else X-RateLimit-Reset, else the provider's window", () => {
    const now = Date.UTC(2026, 0, 1);
    expect(retryAfterSeconds("30")).toBe(30);
    expect(retryAfterSeconds(new Date(now + 60_000).toUTCString(), now)).toBe(
      60
    );
    expect(retryAfterSeconds("999999")).toBe(3600);
    expect(
      rateLimitWaitSeconds(
        "vercel",
        new Headers({ "X-RateLimit-Reset": String(now / 1000 + 42) }),
        now
      )
    ).toBe(42);
    expect(
      rateLimitWaitSeconds("vercel", new Headers({ "Retry-After": "7" }), now)
    ).toBe(7);
    expect(rateLimitWaitSeconds("cloudflare", new Headers(), now)).toBe(300);
    expect(rateLimitWaitSeconds("plausible", new Headers(), now)).toBe(60);
  });

  test.each([
    [
      "a GraphQL budget error",
      () => ({
        data: null,
        errors: [
          {
            message: "rate limiter budget depleted, try again after 5 minutes",
          },
        ],
      }),
    ],
    [
      "a 429 without timing headers",
      () =>
        new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: "rate limiter budget depleted" }],
          }),
          { status: 429 }
        ),
    ],
  ])(
    "Cloudflare's %s waits out its 5-minute budget",
    async (_label, respond) => {
      const error = await fetchCloudflareCrawlerChunk(
        CLOUDFLARE,
        "zone",
        { start: "2026-10-01", end: "2026-10-01" },
        fakeFetch(respond).fetch
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ImportRateLimitedError);
      expect((error as ImportRateLimitedError).retryAfterSeconds).toBe(300);
    }
  );
});

describe("Cloudflare", () => {
  test("lists zones and Web Analytics sites", async () => {
    const { fetch } = fakeFetch((call) => ({
      success: true,
      result: call.url.pathname.endsWith("/zones")
        ? [{ id: "zone-1", name: "example.com", account: { id: "acc-1" } }]
        : // Shape from Cloudflare's API reference: the host lives on the rule.
          [
            {
              site_tag: "site-1",
              rules: [{ host: "example.com", inclusive: true }],
              ruleset: { zone_name: "" },
            },
          ],
      result_info: { page: 1, total_pages: 1 },
    }));
    expect(await listCloudflareSources(CLOUDFLARE, fetch)).toEqual([
      expect.objectContaining({
        ref: "zone-1",
        provider: "cloudflare",
        kind: "geo",
      }),
      expect.objectContaining({
        ref: "acc-1/site-1",
        provider: "cloudflare_rum",
        kind: "web",
        host: "example.com",
      }),
    ]);
  });

  test("crawler queries ask only for AI user agents and never for IPs or query strings", async () => {
    const { fetch, calls: allCalls } = fakeFetch(
      withSettings(() =>
        zonePage([
          crawlerRow(
            "/",
            "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
            "AI Crawler",
            30
          ),
          crawlerRow("/.env", "ClaudeBot/1.0", ""),
          crawlerRow("/docs", "OAI-SearchBot/1.0", "Search Engine Crawler"),
        ])
      )
    );
    const records = await fetchCloudflareCrawlerChunk(
      CLOUDFLARE,
      "zone-tag",
      { start: "2026-10-01", end: "2026-10-01" },
      fetch
    );
    const calls = allCalls.filter(isData);
    const groups = cloudflareUserAgentFilters();
    expect(calls).toHaveLength(groups.length);
    expect(groups.flat()).toContainEqual({ userAgent_like: "%GPTBot%" });
    for (const call of calls) {
      const query = String(call.body?.query);
      expect(query).not.toContain("clientIP");
      expect(query).not.toContain("clientRequestQuery");
      const { filter } = (call.body?.variables ?? {}) as {
        filter: Record<string, unknown>;
      };
      expect(filter).toMatchObject({
        datetime_geq: "2026-10-01T00:00:00.000Z",
        datetime_lt: "2026-10-02T00:00:00.000Z",
        requestSource: "eyeball",
        clientRequestHTTPMethodName: "GET",
      });
      expect(filter.OR).toEqual(expect.arrayContaining([expect.any(Object)]));
    }
    const rows = aggregateGeoRows(
      records.flatMap(
        (record) =>
          toGeoImportedRow(record, { ...CONTEXT, provider: "cloudflare" }) ?? []
      )
    );
    expect(rows.map((row) => [row.source, row.path, row.verified])).toEqual([
      ["GPTBot", "/", 1],
      ["OAI-SearchBot", "/docs", 1],
    ]);
  });

  test("a full crawler page splits the day into smaller windows", async () => {
    let first = true;
    const { fetch, calls } = fakeFetch(
      withSettings(() => {
        const rows = Array.from({ length: first ? 10_000 : 1 }, () =>
          crawlerRow("/", "GPTBot/1.0", "AI Crawler", 1)
        );
        first = false;
        return zonePage(rows);
      })
    );
    await fetchCloudflareCrawlerChunk(
      CLOUDFLARE,
      "zone-tag",
      { start: "2026-10-01", end: "2026-10-01" },
      fetch
    );
    expect(calls.filter(isData).slice(1, 3).map(queryWindow)).toEqual([
      ["2026-10-01T00:00:00.000Z", "2026-10-01T12:00:00.000Z"],
      ["2026-10-01T12:00:00.000Z", "2026-10-02T00:00:00.000Z"],
    ]);
  });

  test("the first day is the first whole day the plan still keeps", () => {
    const limits = { notOlderThan: 8 * DAY, maxDuration: DAY };
    expect(cloudflareEarliestDay(limits, Date.UTC(2026, 10, 5, 6))).toBe(
      "2026-10-29"
    );
    expect(cloudflareEarliestDay(limits, Date.UTC(2026, 10, 5))).toBe(
      "2026-10-29"
    );
  });

  test("crawler days older than the plan keeps are skipped, never requested", async () => {
    const limits = { notOlderThan: 3 * DAY, maxDuration: DAY, enabled: true };
    const { fetch, calls } = fakeFetch(
      withSettings(() => zonePage([]), limits)
    );
    const today = toDay(new Date());
    const earliest = cloudflareEarliestDay(limits);
    expect(
      await previewCloudflareSource(CLOUDFLARE, "cloudflare", "zone-tag", fetch)
    ).toEqual({
      earliestDay: earliest,
      pageviews: null,
      pageviewsByMonth: null,
    });
    await fetchCloudflareCrawlerChunk(
      CLOUDFLARE,
      "zone-tag",
      { start: addDays(today, -10), end: addDays(today, -1) },
      fetch
    );
    const days = calls
      .filter(isData)
      .map((call) => String(queryWindow(call)[0]).slice(0, 10));
    expect(days[0]).toBe(earliest);
    expect(days.at(-1)).toBe(addDays(today, -1));
  });

  test("RUM page loads become page, entry page and audience records without visitors", async () => {
    const { fetch, calls: allCalls } = fakeFetch(
      withSettings((call) => {
        const query = String(call.body?.query);
        let dimensions: Record<string, string> = {
          date: "2026-09-01",
          requestHost: "example.com",
        };
        if (query.includes("requestPath")) {
          dimensions = { ...dimensions, requestPath: "/a" };
        } else if (query.includes("countryName")) {
          dimensions = { date: "2026-09-01", countryName: "DE" };
        }
        return rumPage([{ count: 40, sum: { visits: 12 }, dimensions }]);
      })
    );
    const records = await fetchCloudflareRumChunk(
      CLOUDFLARE,
      "acc-1/site-1",
      { start: "2026-09-01", end: "2026-09-30" },
      fetch
    );
    const calls = allCalls.filter(isData);
    expect(calls).toHaveLength(7);
    expect(calls[0]?.body?.variables).toMatchObject({
      account: "acc-1",
      filter: {
        siteTag: "site-1",
        datetime_geq: "2026-09-01T00:00:00.000Z",
        datetime_lt: "2026-10-01T00:00:00.000Z",
        bot: 0,
      },
    });
    expect(
      records.find((record) => record.grain === "entry_page")
    ).toMatchObject({ path: "/a", entrances: 12 });
    expect(records.every((record) => record.visitors === undefined)).toBe(true);
    expect(records.find((record) => record.grain === "country")).toMatchObject({
      country: "DE",
    });
  });

  test("a full RUM page splits the month on day boundaries until every window is complete", async () => {
    const { fetch, calls } = fakeFetch(
      withSettings((call) => {
        const [from, to] = queryWindow(call);
        const full =
          String(call.body?.query).includes("requestPath") &&
          from === "2026-09-01T00:00:00.000Z" &&
          to === "2026-10-01T00:00:00.000Z";
        return rumPage(
          Array.from({ length: full ? 10_000 : 1 }, (_, index) => ({
            count: 2,
            sum: { visits: 1 },
            dimensions: {
              date: String(from).slice(0, 10),
              requestHost: "example.com",
              requestPath: `/p${index}`,
            },
          }))
        );
      })
    );
    const records = await fetchCloudflareRumChunk(
      CLOUDFLARE,
      "acc-1/site-1",
      { start: "2026-09-01", end: "2026-09-30" },
      fetch
    );
    const pageWindows = calls
      .filter((call) => String(call.body?.query).includes("requestPath"))
      .map(queryWindow);
    expect(pageWindows.slice(1, 3)).toEqual([
      ["2026-09-01T00:00:00.000Z", "2026-09-16T00:00:00.000Z"],
      ["2026-09-16T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
    ]);
    expect(
      records.filter((record) => record.grain === "page").map((r) => r.day)
    ).toEqual(["2026-09-01", "2026-09-16"]);
  });

  test("a RUM hour that still fills the page fails instead of truncating", async () => {
    const { fetch } = fakeFetch(
      withSettings((call) =>
        rumPage(
          String(call.body?.query).includes("requestPath")
            ? Array.from({ length: 10_000 }, (_, index) => ({
                count: 1,
                dimensions: {
                  date: "2026-09-01",
                  requestHost: "example.com",
                  requestPath: `/p${index}`,
                },
              }))
            : []
        )
      )
    );
    await expect(
      fetchCloudflareRumChunk(
        CLOUDFLARE,
        "acc-1/site-1",
        { start: "2026-09-01", end: "2026-09-01" },
        fetch
      )
    ).rejects.toBeInstanceOf(ImportProviderError);
  });

  test("RUM queries never span more than the plan's longest query", async () => {
    const { fetch, calls } = fakeFetch(
      withSettings(() => rumPage([]), {
        notOlderThan: 3650 * DAY,
        maxDuration: 7 * DAY,
        enabled: true,
      })
    );
    await fetchCloudflareRumChunk(
      CLOUDFLARE,
      "acc-1/site-1",
      { start: "2026-09-01", end: "2026-09-30" },
      fetch
    );
    const windows = calls.filter(isData).map(queryWindow);
    expect(windows).toHaveLength(7 * 5);
    for (const [from, to] of windows) {
      expect(
        Date.parse(String(to)) - Date.parse(String(from))
      ).toBeLessThanOrEqual(7 * DAY * 1000);
    }
  });

  test("a RUM chunk on a one-day plan fits one rate-limit window with room to split", async () => {
    const { fetch, calls } = fakeFetch(
      withSettings(() => rumPage([]), {
        notOlderThan: 3650 * DAY,
        maxDuration: DAY,
        enabled: true,
      })
    );
    await fetchCloudflareRumChunk(
      CLOUDFLARE,
      "acc-1/site-1",
      {
        start: "2026-09-01",
        end: addDays("2026-09-01", CLOUDFLARE_RUM_CHUNK_DAYS - 1),
      },
      fetch
    );
    expect(calls.length).toBeLessThanOrEqual(
      IMPORT_RATE_LIMITS.cloudflare.requests / 4
    );
    expect(IMPORT_PROVIDERS.cloudflare_rum.maxChunkDays).toBe(
      CLOUDFLARE_RUM_CHUNK_DAYS
    );
  });

  test("a dataset the plan lacks is a clear provider error", async () => {
    const { fetch } = fakeFetch(
      withSettings(() => rumPage([]), {
        notOlderThan: DAY,
        maxDuration: DAY,
        enabled: false,
      })
    );
    await expect(
      previewCloudflareSource(
        CLOUDFLARE,
        "cloudflare_rum",
        "acc-1/site-1",
        fetch
      )
    ).rejects.toMatchObject({
      detail: "rumPageloadEventsAdaptiveGroups is not available on this plan",
    });
  });
});

describe("Vercel Web Analytics", () => {
  test("lists projects for a team", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      projects: [
        {
          id: "prj_1",
          name: "site",
          targets: { production: { alias: ["example.com"] } },
        },
      ],
      pagination: { next: null },
    }));
    expect(await listVercelProjects(VERCEL, fetch)).toEqual([
      expect.objectContaining({ ref: "prj_1", host: "example.com" }),
    ]);
    expect(calls[0]?.url.searchParams.get("teamId")).toBe("team_abc");
  });

  test("a preview finds the first month with page views in one call", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      data: [
        { timestamp: "2026-05-01T00:00:00.000Z", total: 0, devices: 0 },
        { timestamp: "2026-07-01T00:00:00.000Z", total: 12, devices: 3 },
        { timestamp: "2026-06-01T00:00:00.000Z", total: 5, devices: 2 },
      ],
    }));
    expect(
      await previewVercelProject(
        VERCEL,
        "prj_1",
        { start: "2026-06-10", end: "2026-11-05" },
        fetch
      )
    ).toEqual({
      earliestDay: "2026-06-10",
      pageviews: 17,
      pageviewsByMonth: { "2026-05": 0, "2026-06": 5, "2026-07": 12 },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.searchParams.getAll("by")).toEqual(["month"]);
  });

  test("reads exact daily totals and top-100 breakdowns for production only", async () => {
    const { fetch, calls } = fakeFetch((call) => {
      const by = call.url.searchParams.getAll("by");
      if (by.includes("day")) {
        return {
          data: [
            { timestamp: "2026-09-01T00:00:00Z", pageviews: 100, visitors: 40 },
            { timestamp: "2026-09-02T00:00:00Z", pageviews: 80, visitors: 30 },
          ],
        };
      }
      const dimension = by[0] ?? "";
      return {
        data: [
          {
            [dimension]:
              dimension === "referrerHostname" ? "chatgpt.com" : "/x",
            pageviews: 10,
            visitors: 5,
          },
          { [dimension]: "Others", pageviews: 3, visitors: 2 },
        ],
      };
    });
    const records = await fetchVercelChunk(
      VERCEL,
      "prj_1",
      "example.com",
      { start: "2026-09-01", end: "2026-09-02" },
      fetch
    );
    expect(calls).toHaveLength(1 + 2 * 7);
    for (const call of calls) {
      expect(call.url.pathname).toBe(
        "/v1/query/web-analytics/visits/aggregate"
      );
      expect(call.url.searchParams.get("filter")).toBe(
        "environment eq 'production'"
      );
      expect(call.url.searchParams.get("limit")).toBe("100");
      expect(call.url.searchParams.get("teamId")).toBe("team_abc");
    }
    expect(records.filter((record) => record.grain === "total")).toEqual([
      expect.objectContaining({
        day: "2026-09-01",
        pageviews: 100,
        visitors: 40,
      }),
      expect.objectContaining({
        day: "2026-09-02",
        pageviews: 80,
        visitors: 30,
      }),
    ]);
    expect(
      records.some((record) => Object.values(record).includes("Others"))
    ).toBe(false);
    const sources = records
      .filter((record) => record.grain === "source")
      .map((record) =>
        toWebImportedRow(record, { ...CONTEXT, provider: "vercel" })
      );
    expect(sources[0]).toMatchObject({
      referrer_group: "ai",
      referrer_source: "chatgpt",
      visits: null,
      visitors: 5,
    });
  });

  test("one chunk never needs more requests than one rate-limit window allows", async () => {
    const { fetch, calls } = fakeFetch(() => ({ data: [] }));
    await fetchVercelChunk(
      { token: "vercel-token-1" },
      "prj_1",
      "example.com",
      {
        start: "2026-09-01",
        end: addDays("2026-09-01", VERCEL_CHUNK_DAYS - 1),
      },
      fetch
    );
    expect(calls.length).toBeLessThanOrEqual(
      IMPORT_RATE_LIMITS.vercel.requests
    );
    expect(IMPORT_PROVIDERS.vercel.maxChunkDays).toBe(VERCEL_CHUNK_DAYS);
  });
});
