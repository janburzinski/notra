import { describe, expect, test } from "bun:test";

import {
  IMPORT_PROVIDERS,
  IMPORT_RATE_LIMITS,
  POSTHOG_CHUNK_DAYS,
  POSTHOG_MAX_PROJECTS,
} from "../src/constants/analytics-imports";
import {
  canonicalPostHogSourceRef,
  fetchPostHogChunk,
  listPostHogSources,
  parsePostHogSourceRef,
  previewPostHogSource,
  resolvePostHogCredentials,
} from "../src/imports/posthog";
import { toWebImportedRow } from "../src/imports/rows";
import {
  ImportAuthError,
  ImportProviderError,
} from "../src/schemas/analytics-import-errors";
import type {
  ImportFetch,
  ImportRowContext,
  WebImportRecord,
} from "../src/types/analytics-imports";

const POSTHOG = { apiKey: "phx_1234567890abcdef", region: "eu" as const };
const CONTEXT: ImportRowContext = {
  organizationId: "org",
  projectId: "project",
  siteId: "",
  importId: "imp",
  provider: "posthog",
  host: "example.com",
  importedAt: "2026-11-04 00:00:00",
};

interface Call {
  url: URL;
  method: string;
  headers: Headers;
  sql: string;
  body: Record<string, unknown> | null;
}

function fakeFetch(respond: (call: Call) => Response | unknown[][]): {
  fetch: ImportFetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const call: Call = {
        url: new URL(String(input)),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        sql: String(body?.query?.query ?? ""),
        body,
      };
      calls.push(call);
      const result = respond(call);
      return result instanceof Response
        ? result
        : Response.json({ results: result });
    },
  };
}

const organizations = (teams: Record<string, unknown>[], name = "Acme") =>
  Response.json({ results: [{ id: "org-1", name, teams }] });

describe("PostHog", () => {
  test("finds the region that knows the key", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.hostname === "us.posthog.com"
        ? Response.json(
            { detail: "Invalid personal API key." },
            { status: 401 }
          )
        : organizations([])
    );
    expect(
      await resolvePostHogCredentials({ apiKey: POSTHOG.apiKey }, fetch)
    ).toEqual({ apiKey: POSTHOG.apiKey, region: "eu" });
    expect(calls.map((call) => call.url.hostname)).toEqual([
      "us.posthog.com",
      "eu.posthog.com",
    ]);
    expect(calls[0]?.headers.get("authorization")).toBe(
      `Bearer ${POSTHOG.apiKey}`
    );
  });

  test("a key missing a scope fails in its own region instead of trying the next", async () => {
    const { fetch, calls } = fakeFetch(() =>
      Response.json({ detail: "missing scope" }, { status: 403 })
    );
    await expect(
      resolvePostHogCredentials({ apiKey: POSTHOG.apiKey }, fetch)
    ).rejects.toBeInstanceOf(ImportAuthError);
    expect(calls).toHaveLength(1);
  });

  test("lists each project once per recent host, leaving out demos, local hosts and www twins", async () => {
    const { fetch, calls } = fakeFetch((call) => {
      if (call.url.pathname === "/api/organizations/") {
        return organizations([
          { id: 11, name: "Website" },
          { id: 12, name: "Fresh" },
          { id: 13, name: "Demo", is_demo: true },
        ]);
      }
      return call.url.pathname.includes("/11/")
        ? [
            ["www.acme.com", 900],
            ["localhost:3000", 500],
            ["acme.com", 400],
            ["app.acme.com", 300],
            ["192.168.0.4", 10],
          ]
        : [];
    });
    expect(await listPostHogSources(POSTHOG, fetch)).toEqual([
      {
        ref: "11/acme.com",
        label: "Website · www.acme.com",
        host: "www.acme.com",
        provider: "posthog",
        kind: "web",
      },
      {
        ref: "11/app.acme.com",
        label: "Website · app.acme.com",
        host: "app.acme.com",
        provider: "posthog",
        kind: "web",
      },
      {
        ref: "12",
        label: "Fresh",
        host: "",
        provider: "posthog",
        kind: "web",
      },
    ]);
    const queries = calls.filter((call) => call.method === "POST");
    expect(queries.map((call) => call.url.href)).toEqual([
      "https://eu.posthog.com/api/projects/11/query/",
      "https://eu.posthog.com/api/projects/12/query/",
    ]);
  });

  test("a preview counts page views per day for the listed host", async () => {
    const { fetch, calls } = fakeFetch(() => [
      ["2025-04-16", 0],
      ["2025-04-17", 120],
      ["2025-05-01", 80],
    ]);
    expect(
      await previewPostHogSource(POSTHOG, "11/www.acme.com", fetch)
    ).toEqual({
      earliestDay: "2025-04-17",
      pageviews: 200,
      pageviewsByMonth: {
        "2025-04-16": 0,
        "2025-04-17": 120,
        "2025-05-01": 80,
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain(
      "properties.$host IN ('acme.com', 'www.acme.com')"
    );
    expect(calls[0]?.body).toMatchObject({
      query: {
        kind: "HogQLQuery",
        modifiers: { convertToProjectTimezone: false },
      },
    });
  });

  test("reads totals and every breakdown of a chunk, one query each", async () => {
    const day = "2026-09-01";
    const { fetch, calls } = fakeFetch(({ sql }) => {
      if (sql.includes("$entry_referring_domain")) {
        return [
          [day, "$direct", "", 30, 20, 25, 15, 900],
          [day, "", "chatgpt.com", 6, 3, 4, 1, 300],
        ];
      }
      if (sql.includes("$entry_utm_medium")) {
        return [
          [day, "", "", "", 40, 30, 35, 20, 1000],
          [day, "newsletter", "email", "launch", 5, 4, 4, 1, 200],
        ];
      }
      if (sql.includes("$entry_pathname")) {
        return [[day, "/pricing", 12, 7, 8, 2, 400]];
      }
      if (sql.includes("properties.$pathname")) {
        return [
          [day, "/pricing", 20, 10],
          [day, null, 3, 3],
        ];
      }
      if (sql.includes(" AS d0")) {
        return [];
      }
      return [[day, 100, 30, 40, 10, 2400]];
    });
    const range = { start: day, end: "2026-09-02" };
    const records = await fetchPostHogChunk(
      POSTHOG,
      "11/acme.com",
      "acme.com",
      range,
      fetch
    );
    expect(calls).toHaveLength(9);
    for (const call of calls) {
      expect(call.sql).toContain(
        "timestamp >= toDateTime('2026-09-01 00:00:00', 'UTC')"
      );
      expect(call.sql).toContain(
        "timestamp < toDateTime('2026-09-03 00:00:00', 'UTC')"
      );
      expect(call.sql).toContain("LIMIT 200 BY day");
    }
    expect(records.filter((record) => record.grain === "total")).toEqual([
      {
        grain: "total",
        day,
        host: "acme.com",
        pageviews: 100,
        visitors: 30,
        visits: 40,
        bounces: 10,
        visitDurationS: 2400,
      },
    ]);
    expect(
      records.find((record) => record.grain === "entry_page")
    ).toMatchObject({ path: "/pricing", visits: 8, entrances: 8, bounces: 2 });
    expect(records.filter((record) => record.grain === "page")).toEqual([
      {
        grain: "page",
        day,
        host: "acme.com",
        path: "/pricing",
        pageviews: 20,
        visitors: 10,
      },
    ]);
    const campaigns = records.filter((record) => record.grain === "campaign");
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]).toMatchObject({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "launch",
    });
    const sources = records.filter((record) => record.grain === "source");
    expect(sources[0]?.referrer).toBe("");
    expect(
      toWebImportedRow(sources[1] as WebImportRecord, CONTEXT)
    ).toMatchObject({
      referrer_group: "ai",
      referrer_source: "chatgpt",
      visits: 4,
      visitors: 3,
    });
  });

  test("an import has one ref per host, whatever its spelling or where it came from", () => {
    expect(canonicalPostHogSourceRef("11/acme.com", "www.acme.com")).toBe(
      "11/acme.com"
    );
    // A listed host wins over the Notra domain it is stored under.
    expect(canonicalPostHogSourceRef("11/acme.com", "notra.example")).toBe(
      "11/acme.com"
    );
    // A project listed without a host reads the domain typed for it.
    expect(canonicalPostHogSourceRef("12", "WWW.Old.Acme.com")).toBe(
      "12/old.acme.com"
    );
    expect(() => canonicalPostHogSourceRef("12", "old acme")).toThrow(
      ImportProviderError
    );
  });

  test("a chunk reads the ref's host and stores rows under the import's domain", async () => {
    const { fetch, calls } = fakeFetch(() => [["2026-09-01", 5, 2, 2, 0, 30]]);
    const records = await fetchPostHogChunk(
      POSTHOG,
      "11/blog.acme.com",
      "acme.com",
      { start: "2026-09-01", end: "2026-09-01" },
      fetch
    );
    for (const call of calls) {
      expect(call.sql).toContain(
        "properties.$host IN ('blog.acme.com', 'www.blog.acme.com')"
      );
    }
    expect(records[0]).toMatchObject({ grain: "total", host: "acme.com" });
  });

  test("lists every project, looking up hosts only for the first ones", async () => {
    const teams = Array.from({ length: POSTHOG_MAX_PROJECTS + 2 }, (_, i) => ({
      id: 100 + i,
      name: `Site ${i}`,
    }));
    const { fetch, calls } = fakeFetch((call) =>
      call.url.pathname === "/api/organizations/"
        ? organizations(teams)
        : [["acme.com", 10]]
    );
    const sources = await listPostHogSources(POSTHOG, fetch);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(
      POSTHOG_MAX_PROJECTS
    );
    expect(new Set(sources.map((source) => source.ref.split("/")[0]))).toEqual(
      new Set(teams.map((team) => String(team.id)))
    );
    expect(sources.at(-1)).toMatchObject({ ref: "121", host: "" });
  });

  test("a host that isn't a hostname never reaches a query", async () => {
    const { fetch, calls } = fakeFetch(() => []);
    await expect(
      fetchPostHogChunk(
        POSTHOG,
        "11",
        "acme.com') OR 1=1 --",
        { start: "2026-09-01", end: "2026-09-01" },
        fetch
      )
    ).rejects.toBeInstanceOf(ImportProviderError);
    expect(calls).toHaveLength(0);
    expect(() => parsePostHogSourceRef("../11")).toThrow(ImportProviderError);
  });

  test("a year fits one hour of the request budget", () => {
    const chunks = Math.ceil(366 / POSTHOG_CHUNK_DAYS);
    expect(chunks * 9).toBeLessThanOrEqual(IMPORT_RATE_LIMITS.posthog.requests);
    expect(IMPORT_PROVIDERS.posthog.maxChunkDays).toBe(POSTHOG_CHUNK_DAYS);
  });
});
