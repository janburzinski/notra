import { afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { randomBytes } from "node:crypto";

import { GSC_SEARCH_ANALYTICS_BASE_URL } from "../constants/google-search-console";
import type { GscIntegrationRow } from "../types/google-search-console";

process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken } = await import("@notra/db/utils/integration-encryption");
const { queryGscQueryPages, queryGscTopQueries } =
  await import("./google-search-console");

let integration: GscIntegrationRow;

beforeAll(() => {
  integration = {
    id: "gsc-test",
    organizationId: "org-test",
    status: "active",
    disconnectingAt: null,
    encryptedAccessToken: encryptToken("access-token"),
    accessTokenExpiresAt: new Date("2099-01-01"),
  } as GscIntegrationRow;
});

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | null =
  null;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

function mockSearchAnalytics(rows: unknown[]) {
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ rows })
  );
  return fetchSpy;
}

function sentBody(spy: NonNullable<typeof fetchSpy>) {
  const init = spy.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body));
}

const params = { siteUrl: "sc-domain:example.com", days: 28, rowLimit: 50_000 };

describe("queryGscQueryPages", () => {
  test("asks for query and page pairs and keeps both keys", async () => {
    const spy = mockSearchAnalytics([
      {
        keys: ["notion alternatives", "https://example.com/alternatives"],
        clicks: 2,
        impressions: 90,
        ctr: 0.02,
        position: 6.4,
      },
      { keys: ["no page"], clicks: 0, impressions: 5, ctr: 0, position: 9 },
      {
        keys: ["", "https://example.com/"],
        clicks: 0,
        impressions: 5,
        ctr: 0,
        position: 9,
      },
    ]);

    const rows = await queryGscQueryPages(integration, params);

    expect(rows).toEqual([
      {
        query: "notion alternatives",
        page: "https://example.com/alternatives",
        clicks: 2,
        impressions: 90,
        position: 6.4,
      },
    ]);
    expect(String(spy.mock.calls[0]?.[0])).toBe(
      `${GSC_SEARCH_ANALYTICS_BASE_URL}/sc-domain%3Aexample.com/searchAnalytics/query`
    );
    const body = sentBody(spy);
    expect(body.dimensions).toEqual(["query", "page"]);
    expect(body.type).toBe("web");
    expect(body.rowLimit).toBe(25_000);
    expect(body).not.toHaveProperty("dimensionFilterGroups");
    expect(
      new Headers(spy.mock.calls[0]?.[1]?.headers).get("Authorization")
    ).toBe("Bearer access-token");
  });
});

describe("queryGscTopQueries", () => {
  test("still asks for queries only, with the optional regex filter", async () => {
    const spy = mockSearchAnalytics([
      { keys: ["crm"], clicks: 1, impressions: 40, ctr: 0.025, position: 7 },
    ]);

    const rows = await queryGscTopQueries(integration, {
      ...params,
      rowLimit: 1000,
      queryPattern: "\\?$",
    });

    expect(rows).toEqual([
      { query: "crm", clicks: 1, impressions: 40, position: 7 },
    ]);
    const body = sentBody(spy);
    expect(body.dimensions).toEqual(["query"]);
    expect(body.rowLimit).toBe(1000);
    expect(body.dimensionFilterGroups).toEqual([
      {
        filters: [
          {
            dimension: "query",
            operator: "includingRegex",
            expression: "\\?$",
          },
        ],
      },
    ]);
  });
});
