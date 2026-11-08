import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AnalyticsImportSummary } from "@notra/geo-core/types/analytics-import-summary";
import type {
  GeoWebSetupResponse,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";
import { Effect } from "effect";

import type { AuthData } from "../src/types/auth";

const UNDOCUMENTED_SECRET = "jane@example.com";
const CREDENTIAL = "plausible_api_key_secret";

const web: WebAnalyticsResponse = {
  configured: true,
  imported: { provider: "plausible", until: "2026-10-01", nativeStart: null },
  hosts: [{ host: "www.acme.com", siteId: "", views: 120 }],
  totals: {
    views: 120,
    previousViews: 80,
    visitors: 40,
    previousVisitors: 30,
    sessions: 50,
    previousSessions: 35,
    engagedSessions: 20,
    aiVisitors: 4,
    previousAiVisitors: 2,
  },
  points: [],
  pages: [],
  sources: [],
  countries: [],
  devices: [],
  outcomes: [],
  script: {
    outboundLinks: [
      {
        url: "github.com/acme",
        clicks: 4,
        previousClicks: 1,
        visitors: 3,
        // A loader that ever returned more fields must not leak them.
        ...({ props: { email: UNDOCUMENTED_SECRET } } as object),
      },
    ],
    vitals: [
      {
        metric: "lcp",
        p75: 1800,
        samples: 40,
        good: 30,
        needsImprovement: 8,
        poor: 2,
      },
    ],
    vitalsByDevice: { mobile: [], desktop: [] },
    errors: [],
    languages: [],
  },
};

const importSummary: AnalyticsImportSummary = {
  id: "imp_1",
  projectId: "proj_1",
  provider: "plausible",
  kind: "web",
  sourceLabel: "acme.com",
  host: "acme.com",
  status: "running",
  startDay: "2025-01-01",
  endDay: "2026-09-30",
  cutoffDay: "2026-10-01",
  chunksTotal: 21,
  chunksDone: 7,
  pageviewsImported: 12_000,
  rowsWritten: 900,
  capabilities: {
    visitors: true,
    visits: true,
    bounces: true,
    utm: true,
    entryPages: true,
    sampled: false,
  },
  lastError: null,
  retryAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  completedAt: null,
};

const serverSetup = {
  ingestUrl: "https://app.usenotra.com/api/collect",
  snippet: "next snippet",
  snippets: {
    next: "next",
    nuxt: "nuxt",
    netlify: "netlify",
    tanstack: "tanstack",
    astro: "astro",
    sveltekit: "sveltekit",
    reactRouter: "reactRouter",
  },
  drainUrls: { vercel: "https://v", cloudflare: "https://c" },
};
const webSetup: GeoWebSetupResponse = {
  ...serverSetup,
  webKey: "nwk_public",
  webSnippet: '<script src="https://app.usenotra.com/notra.js"></script>',
  webScript: {
    url: "https://app.usenotra.com/notra.js",
    pinnedUrl: "https://app.usenotra.com/r/notra.abc.js",
    integrity: "sha384-abc",
  },
  webPlusScript: {
    url: "https://app.usenotra.com/notra.plus.js",
    pinnedUrl: "https://app.usenotra.com/r/notra.plus.abc.js",
    integrity: "sha384-def",
  },
};

const loadWebAnalytics = mock((..._args: unknown[]) => Effect.succeed(web));
const loadAiTraffic = mock((..._args: unknown[]) => Effect.succeed({}));
const loadGeoJourneyStats = mock((..._args: unknown[]) => Effect.succeed({}));
const listAnalyticsImportSummaries = mock((..._args: unknown[]) =>
  Effect.succeed([{ ...importSummary, credentials: CREDENTIAL }])
);
const loadGeoWebSetupResponse = mock((..._args: unknown[]) =>
  Effect.succeed(webSetup)
);

let webAnalyticsEnabled = true;
const isWebAnalyticsEnabledForOrganization = mock(
  async (_organizationId: string) => webAnalyticsEnabled
);
mock.module("@notra/ai/utils/web-analytics-access", () => ({
  isWebAnalyticsEnabledForOrganization,
  resolveWebAnalyticsFlagState: async (organizationId: string) =>
    (await isWebAnalyticsEnabledForOrganization(organizationId))
      ? "enabled"
      : "disabled",
  webAnalyticsFlagState: (organizationId: string) =>
    Effect.promise(async () =>
      (await isWebAnalyticsEnabledForOrganization(organizationId))
        ? "enabled"
        : "disabled"
    ),
}));

const realPrograms = await import("@notra/geo-core/geo/programs");
mock.module("@notra/geo-core/geo/programs", () => ({
  ...realPrograms,
  loadAiTraffic,
  loadGeoJourneyStats,
}));
const realWebAnalytics = await import("@notra/geo-core/geo/web-analytics");
mock.module("@notra/geo-core/geo/web-analytics", () => ({
  ...realWebAnalytics,
  loadWebAnalytics,
}));
const realImports = await import("@notra/geo-core/geo/analytics-imports");
mock.module("@notra/geo-core/geo/analytics-imports", () => ({
  ...realImports,
  listAnalyticsImportSummaries,
}));
const realIngest = await import("@notra/geo-core/geo/ingest");
mock.module("@notra/geo-core/geo/ingest", () => ({
  ...realIngest,
  isGeoIngestConfigured: () => true,
  loadGeoWebSetupResponse,
  issueGeoIngestSetupResponse: (_input: unknown, withWeb = true) =>
    Effect.succeed({
      ...(withWeb ? webSetup : serverSetup),
      token: "ntt_secret",
    }),
}));
mock.module("../src/runtime/geo", () => ({
  runGeoEffect: async (_label: string, effect: Effect.Effect<unknown>) => ({
    ok: true,
    value: await Effect.runPromise(effect),
  }),
}));

const { geoTrafficRoutes } = await import("../src/routes/geo-traffic");
const { geoWebAnalyticsRoutes } =
  await import("../src/routes/geo-web-analytics");
const { createOpenApiApp } = await import("../src/utils/openapi-app");
const { webAnalyticsMiddleware } =
  await import("../src/middleware/web-analytics");
const { WEB_ANALYTICS_ROUTE_PATHS } =
  await import("../src/constants/web-analytics");

const organization = { id: "org_1", slug: "acme", name: "Acme", logo: null };
const organizationKey = {
  keyId: "key_1",
  identity: { externalId: "org_1" },
} as AuthData;

function createApp() {
  const db = {};
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", organizationKey);
    c.set("db", db as never);
    c.set("geo", {
      db: db as never,
      organization,
      organizationId: organization.id,
    });
    await next();
  });
  const requireWebAnalytics = webAnalyticsMiddleware();
  for (const path of WEB_ANALYTICS_ROUTE_PATHS) {
    app.use(path, requireWebAnalytics);
  }
  app.route("/v1", geoTrafficRoutes);
  app.route("/v1", geoWebAnalyticsRoutes);
  return app;
}

const scope = { organizationId: "org_1", projectId: "proj_1" };

beforeEach(() => {
  webAnalyticsEnabled = true;
  mock.clearAllMocks();
});

describe("web analytics API", () => {
  test("returns the summary only, with the dashboard's filters", async () => {
    const response = await createApp().request(
      "/v1/projects/proj_1/geo/traffic/web?days=7&host=www.acme.com&path=/pricing&sites=exclude"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadWebAnalytics).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ days: 7 }),
      "www.acme.com",
      "/pricing",
      "exclude",
      "summary"
    );
    expect(Object.keys(body).sort()).toEqual([
      "configured",
      "hosts",
      "imported",
      "organization",
      "points",
      "totals",
    ]);
    expect(body.organization).toEqual(organization);
  });

  test("flattens breakdowns and returns only documented fields", async () => {
    const response = await createApp().request(
      "/v1/projects/proj_1/geo/traffic/web/breakdowns?from=2026-10-01&to=2026-10-31"
    );
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(loadWebAnalytics).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ from: "2026-10-01", to: "2026-10-31" }),
      undefined,
      undefined,
      undefined,
      "breakdowns",
      { scriptReports: true }
    );
    expect(body.outboundLinks).toEqual([
      { url: "github.com/acme", clicks: 4, previousClicks: 1, visitors: 3 },
    ]);
    expect(body.vitals).toEqual([{ metric: "lcp", p75: 1800, samples: 40 }]);
    expect(body.totals).toBeUndefined();
    expect(body.script).toBeUndefined();
    expect(text).not.toContain(UNDOCUMENTED_SECRET);
  });

  test.each([
    ["a range over 366 days", "from=2025-01-01&to=2026-06-01"],
    ["from after to", "from=2026-10-31&to=2026-10-01"],
    ["an impossible day", "from=2026-02-30&to=2026-03-01"],
    ["a path without a slash", "path=pricing"],
  ])("rejects %s before querying", async (_name, query) => {
    const response = await createApp().request(
      `/v1/projects/proj_1/geo/traffic/web?${query}`
    );

    expect(response.status).toBe(400);
    expect(loadWebAnalytics).not.toHaveBeenCalled();
  });

  test.each([true, false])(
    "filters the AI traffic overview like the dashboard (flag %p)",
    async (enabled) => {
      webAnalyticsEnabled = enabled;
      const response = await createApp().request(
        "/v1/projects/proj_1/geo/traffic/overview?days=30&host=https://www.Acme.com/x&path=/docs"
      );

      expect(response.status).toBe(200);
      expect(loadAiTraffic).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ days: 30 }),
        ["acme.com"],
        "",
        "/docs",
        undefined
      );
    }
  );

  test("lists imports without connection credentials", async () => {
    const response = await createApp().request(
      "/v1/projects/proj_1/geo/traffic/imports"
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(listAnalyticsImportSummaries).toHaveBeenCalledWith(
      "org_1",
      "proj_1"
    );
    expect(JSON.parse(text).imports).toEqual([importSummary]);
    expect(text).not.toContain(CREDENTIAL);
  });

  test("read access gets the public web key and pinned scripts, never the token", async () => {
    const response = await createApp().request(
      "/v1/geo/ingest/setup?projectId=proj_1"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadGeoWebSetupResponse).toHaveBeenCalledWith(scope);
    expect(body.webKey).toBe("nwk_public");
    expect(body.webScript.integrity).toBe("sha384-abc");
    expect(body.token).toBeUndefined();
  });
});

describe("without the web analytics flag", () => {
  beforeEach(() => {
    webAnalyticsEnabled = false;
  });

  test.each([
    "/v1/projects/proj_1/geo/traffic/web",
    "/v1/projects/proj_1/geo/traffic/web/breakdowns",
    "/v1/projects/proj_1/geo/traffic/imports",
    "/v1/projects/proj_1/geo/traffic/journey-stats",
  ])("%s answers 403 before loading anything", async (path) => {
    const response = await createApp().request(path);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Web analytics is not available for this workspace yet.",
    });
    expect(isWebAnalyticsEnabledForOrganization).toHaveBeenCalledWith("org_1");
    expect(loadWebAnalytics).not.toHaveBeenCalled();
    expect(loadGeoJourneyStats).not.toHaveBeenCalled();
    expect(listAnalyticsImportSummaries).not.toHaveBeenCalled();
  });

  test.each([
    ["setup", "/v1/geo/ingest/setup?projectId=proj_1", "GET"],
    ["an issued token", "/v1/geo/ingest/token", "POST"],
  ])("%s comes without notra.js", async (_name, path, method) => {
    const response = await createApp().request(path, { method });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadGeoWebSetupResponse).not.toHaveBeenCalled();
    expect(body.ingestUrl).toBeString();
    for (const field of [
      "webKey",
      "webSnippet",
      "webScript",
      "webPlusScript",
    ]) {
      expect(body[field]).toBeUndefined();
    }
  });
});
