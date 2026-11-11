import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import {
  purgeDeletedOrganizationAnalytics,
  purgeDeletedProjectAnalytics,
  purgeDeletedSiteAnalytics,
  purgeImportedRows,
  purgeSocialAccountData,
} from "./purge";

const originalFetch = globalThis.fetch;
const originalToken = process.env.TINYBIRD_TOKEN;
let deletes: { datasource: string; condition: string }[] = [];

beforeEach(() => {
  process.env.TINYBIRD_TOKEN = "test";
  deletes = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init) => {
    const datasource = String(input).split("/datasources/")[1]?.split("/")[0];
    if (datasource) {
      const body = new URLSearchParams(String(init?.body ?? ""));
      deletes.push({
        datasource,
        condition: body.get("delete_condition") ?? "",
      });
    }
    return Response.json({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.TINYBIRD_TOKEN = originalToken;
});

const GEO = [
  "geo_traffic_events",
  "geo_traffic_daily",
  "geo_traffic_pages_by_host_daily",
  "geo_imported_daily",
];
const WEB = [
  "web_page_views",
  "web_page_engagement",
  "web_events",
  "web_errors",
  "web_pages_daily",
  "web_sources_daily",
  "web_audience_daily",
];
const PROJECT = [
  ...GEO,
  ...WEB,
  "mcp_events",
  "mcp_daily",
  "web_imported_daily",
];
const SOCIAL = [
  "social_accounts",
  "social_account_stats",
  "social_posts",
  "social_post_stats",
  "social_post_stats_latest",
  "social_account_stats_latest",
  "social_post_sources",
];

test.each([
  [
    "project",
    () => purgeDeletedProjectAnalytics({ organizationId: "o", projectId: "p" }),
    PROJECT,
    "organization_id = 'o' AND project_id = 'p'",
  ],
  [
    "organization",
    () => purgeDeletedOrganizationAnalytics({ organizationId: "o" }),
    [...SOCIAL, ...PROJECT],
    "organization_id = 'o'",
  ],
  [
    "site",
    () => purgeDeletedSiteAnalytics({ organizationId: "o", siteId: "s" }),
    [...GEO, ...WEB],
    "organization_id = 'o' AND site_id = 's'",
  ],
])(
  "deleting a %s purges every datasource once",
  async (_scope, purge, datasources, condition) => {
    await purge();
    expect(deletes.map((item) => item.datasource).toSorted()).toEqual(
      datasources.toSorted()
    );
    expect(new Set(deletes.map((item) => item.condition))).toEqual(
      new Set([condition])
    );
  }
);

test.each([
  [
    "an id with a quote",
    () => purgeDeletedOrganizationAnalytics({ organizationId: "o' OR 1=1 --" }),
  ],
  [
    "an id with a backslash",
    () =>
      purgeDeletedProjectAnalytics({ organizationId: "org", projectId: "p\\" }),
  ],
  [
    "a day that is not a date",
    () =>
      purgeImportedRows({
        organizationId: "org",
        importId: "imp",
        fromDay: "2026-01-01') OR (1=1",
        toDay: "2026-01-31",
      }),
  ],
  [
    "an account id with a quote",
    () =>
      purgeSocialAccountData({
        organizationId: "org",
        provider: "x",
        providerAccountId: "1' OR '1'='1",
      }),
  ],
])("refuses %s before sending anything", async (_label, purge) => {
  await expect(purge()).rejects.toThrow("Refusing a Tinybird delete");
  expect(deletes).toEqual([]);
});

test("imported rows and platform account ids keep their exact values", async () => {
  await purgeImportedRows({
    organizationId: "org",
    importId: "imp_1",
    fromDay: "2026-01-01",
    toDay: "2026-01-31",
  });
  expect(deletes).toEqual(
    ["web_imported_daily", "geo_imported_daily"].map((datasource) => ({
      datasource,
      condition:
        "organization_id = 'org' AND import_id = 'imp_1' AND day >= toDate('2026-01-01') AND day <= toDate('2026-01-31')",
    }))
  );
  await purgeSocialAccountData({
    organizationId: "org",
    provider: "bluesky",
    providerAccountId: "did:plc:z72i7hdynmk6r22z27h6tvur",
  }).catch(() => undefined);
  expect(deletes.at(-1)?.condition).toContain(
    "provider_account_id = 'did:plc:z72i7hdynmk6r22z27h6tvur'"
  );
});

test("a full Tinybird delete queue waits for a free slot", async () => {
  let refused = 1;
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/jobs/")) {
      return Response.json({ status: "done" });
    }
    if (url.includes("/web_imported_daily/") && refused > 0) {
      refused -= 1;
      return new Response("maximum number of concurrent delete jobs", {
        status: 429,
      });
    }
    deletes.push({ datasource: url, condition: "" });
    return Response.json({ job_id: "job" });
  }) as unknown as typeof fetch;
  await purgeImportedRows({ organizationId: "org", importId: "imp_1" });
  expect(refused).toBe(0);
  expect(deletes).toHaveLength(2);
}, 20_000);

test("an import purge deletes one datasource at a time and stops at a failure", async () => {
  const submitted: string[] = [];
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/jobs/")) {
      return Response.json({ status: "done" });
    }
    submitted.push(url.split("/datasources/")[1]?.split("/")[0] ?? "");
    return url.includes("/web_imported_daily/")
      ? new Response("broken", { status: 500 })
      : Response.json({ job_id: "job" });
  }) as unknown as typeof fetch;
  await expect(
    purgeImportedRows({ organizationId: "org", importId: "imp_1" })
  ).rejects.toThrow("web_imported_daily failed (500)");
  expect(submitted).toEqual(["web_imported_daily"]);
});
