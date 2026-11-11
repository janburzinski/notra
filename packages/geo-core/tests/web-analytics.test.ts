import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import { Effect } from "effect";

import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "web analytics uses validated scopes without tracking lookups",
    import.meta.url
  );
} else {
  await import("./utils/infrastructure");
  const { database, initializeDatabase, resetDatabase, seedProject, testDb } =
    await import("./utils/database");
  const requests: Record<string, unknown>[] = [];
  const IMPORT_CAPABILITIES = {
    visitors: true,
    visits: true,
    bounces: true,
    utm: true,
    entryPages: true,
    sampled: false,
  };
  let views = 0;
  let configured = true;
  let demo = false;
  let failedQuery = "";
  let nativeFirstDay = "1970-01-01";
  const query = mock(async (params: Record<string, unknown>) => {
    requests.push(params);
    return configured ? { data: [] } : null;
  });
  const client = await import("@notra/analytics/tinybird/client");
  const demoMode = await import("@notra/utils/demo-mode");
  mock.module("@notra/utils/demo-mode", () => ({
    ...demoMode,
    isDemoMode: () => demo,
  }));
  const webQuery = (params: Record<string, unknown>) =>
    demo ? Promise.resolve(null) : query(params);
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...client,
    isTinybirdConfigured: () => configured,
    queryWebOverview: async (params: Record<string, unknown>) => {
      requests.push(params);
      if (failedQuery === "overview") {
        throw new Error("Tinybird unavailable");
      }
      return configured && !demo
        ? { data: [{ views, visitors: views }] }
        : null;
    },
    queryWebAiOutcomes: webQuery,
    queryWebAudience: webQuery,
    queryWebHosts: webQuery,
    queryWebPages: webQuery,
    queryWebSources: webQuery,
    queryWebTimeseries: (params: Record<string, unknown>) => {
      if (failedQuery === "timeseries") {
        return Promise.reject(new Error("Tinybird unavailable"));
      }
      return webQuery(params);
    },
    queryWebEngagement: (params: Record<string, unknown>) => {
      if (failedQuery === "engagement") {
        return Promise.resolve(null);
      }
      return webQuery(params);
    },
    queryGeoTrafficOverview: (params: Record<string, unknown>) => {
      if (failedQuery === "traffic") {
        return Promise.reject(new Error("Tinybird unavailable"));
      }
      return query(params);
    },
    queryGeoTrafficTimeseries: query,
    queryGeoTrafficPages: query,
    queryWebOutboundLinks: async () => ({
      data: [
        {
          url: "docs.example.org/start",
          clicks: 2,
          previous_clicks: 0,
          visitors: 2,
        },
      ],
    }),
    queryWebVitals: async () => ({
      data: [
        ["lcp", "all", 1800],
        ["lcp", "mobile", 3100],
        ["unknown", "all", 1],
      ].map(([metric, device, p75]) => ({
        metric,
        device,
        p75,
        samples: 4,
        good: 1,
        needs_improvement: 2,
        poor: 1,
      })),
    }),
    queryWebErrorsTop: () => Promise.reject(new Error("pipe not deployed")),
    queryWebNativeFirstDay: async (params: Record<string, unknown>) => {
      requests.push(params);
      return {
        data: [{ web_first_day: nativeFirstDay, geo_first_day: "1970-01-01" }],
      };
    },
    queryWebLanguages: async () => ({
      data: [{ value: "de", visitors: 5, previous_visitors: 2 }],
    }),
  }));
  const {
    loadWebAnalytics,
    loadSiteAnalytics,
    loadSiteVisitorTotals,
    loadWebTrackingStatus,
  } = await import("../src/geo/web-analytics");
  const { forgetCompletedImportIds } =
    await import("../src/geo/analytics-imports");
  const { loadGeoTrafficPages } = await import("../src/geo/programs");
  const { GeoProjectNotFoundError, GeoTinybirdError } =
    await import("../src/geo/errors");

  beforeAll(initializeDatabase, 30_000);
  afterAll(() => database.postgres.close());
  beforeEach(async () => {
    await resetDatabase();
    requests.length = 0;
    views = 0;
    configured = true;
    demo = false;
    failedQuery = "";
    nativeFirstDay = "1970-01-01";
  });

  test("the install status waits for the project's first page view", async () => {
    const scope = await seedProject("web-status");
    // Tinybird answers min() over no rows with 1970-01-01.
    expect(await Effect.runPromise(loadWebTrackingStatus(scope))).toEqual({
      firstDay: null,
    });
    expect(requests.at(-1)).toEqual({
      organization_id: scope.organizationId,
      project_id: scope.projectId,
      hosts: "",
    });
    nativeFirstDay = "2026-10-01";
    expect(await Effect.runPromise(loadWebTrackingStatus(scope))).toEqual({
      firstDay: "2026-10-01",
    });
  });

  test("an authenticated project queries data without site or opt-in lookups", async () => {
    const scope = await seedProject("web-data");
    views = 3;
    const response = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, "www.example.com")
    );
    expect(response.totals.views).toBe(3);
    expect(response).not.toHaveProperty("tracking");
    expect(response).not.toHaveProperty("trackVisitors");
    expect(requests).toHaveLength(9);
    for (const params of requests) {
      expect(params).toMatchObject({
        organization_id: scope.organizationId,
        project_id: scope.projectId,
        site_id: "",
      });
    }
    expect(
      requests.filter((params) => params.hosts === "example.com")
    ).toHaveLength(8);
    // Time on page comes as the overall row only, without page rows.
    expect(requests.filter((params) => params.limit === 0)).toHaveLength(1);
    expect(response.engagement).toEqual({
      views: 0,
      avgSeconds: 0,
      previousAvgSeconds: 0,
      pages: [],
    });
  });

  test.each([
    ["breakdowns", "breakdowns", undefined],
    ["a summary without web analytics", "summary", { engagement: false }],
  ] as const)(
    "%s skip the time-on-page query",
    async (_label, view, options) => {
      const scope = await seedProject(`web-${view}`);
      const response = await Effect.runPromise(
        loadWebAnalytics(
          scope,
          { days: 7 },
          undefined,
          "",
          undefined,
          view,
          options
        )
      );
      expect(response).not.toHaveProperty("engagement");
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.filter((params) => params.limit === 0)).toHaveLength(0);
    }
  );

  test("only completed imports of the project are passed on, and none without the flag", async () => {
    const scope = await seedProject("web-imports");
    const { analyticsImports } = await import("@notra/db/schema");
    await testDb.insert(analyticsImports).values(
      (
        [
          ["imp-done-b", "web", "completed"],
          ["imp-done-a", "web", "completed"],
          ["imp-running", "web", "running"],
          ["imp-deleting", "web", "deleting"],
          ["imp-geo", "geo", "completed"],
          ["imp-geo-running", "geo", "running"],
        ] as const
      ).map(([id, kind, status]) => ({
        id,
        kind,
        status,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        provider: "plausible_csv" as const,
        externalSiteRef: "example.com",
        host: `${id}.example.com`,
        capabilities: IMPORT_CAPABILITIES,
      }))
    );
    const webImports = async () => {
      requests.length = 0;
      forgetCompletedImportIds(scope.organizationId);
      await Effect.runPromise(loadWebAnalytics(scope, { days: 7 }, undefined));
      return requests.flatMap((params) =>
        "imports" in params ? [params.imports] : []
      );
    };
    expect(await webImports()).toEqual(
      Array.from({ length: 7 }, () => "imp-done-a,imp-done-b")
    );
    requests.length = 0;
    await Effect.runPromise(
      loadSiteAnalytics(
        { ...scope, id: "site-imports", publicOrigin: "https://site.example" },
        { days: 7 }
      )
    );
    expect(requests.some((params) => params.imports === "imp-geo")).toBe(true);
    requests.length = 0;
    await Effect.runPromise(
      loadGeoTrafficPages(scope, { days: 7 }, 20, undefined, undefined)
    );
    expect(requests[0]).toMatchObject({ imports: "imp-geo" });
    forgetCompletedImportIds(scope.organizationId);
  });

  test("a foreign project is rejected before any analytics query", async () => {
    const scope = await seedProject("foreign-web", {
      organizationId: "other-org",
    });
    const outcome = await Effect.runPromise(
      Effect.result(
        loadWebAnalytics(
          { ...scope, organizationId: "org-test" },
          { days: 7 },
          undefined
        )
      )
    );
    expect(outcome._tag === "Failure" && outcome.failure).toBeInstanceOf(
      GeoProjectNotFoundError
    );
    expect(requests).toEqual([]);
  });

  test("site queries keep stable identity across origins and sibling sites", async () => {
    const scope = await seedProject("site-data");
    for (const [siteId, publicOrigin] of [
      ["site-a", "https://shared.example"],
      ["site-b", "https://shared.example"],
      ["site-a", "https://changed.example"],
    ] as const) {
      requests.length = 0;
      await Effect.runPromise(
        loadSiteAnalytics(
          {
            ...scope,
            id: siteId,
            publicOrigin,
          },
          { days: 7 }
        )
      );
      expect(requests).toHaveLength(11);
      for (const params of requests) {
        expect(params).toMatchObject({
          organization_id: scope.organizationId,
          project_id: "",
          site_id: siteId,
          hosts: "",
        });
      }
    }
  });

  test.each(["overview", "timeseries", "engagement", "traffic"])(
    "failed site %s queries do not become empty analytics",
    async (failure) => {
      const scope = await seedProject(`failed-${failure}`);
      failedQuery = failure;
      const result = await Effect.runPromise(
        Effect.result(
          loadSiteAnalytics(
            { ...scope, id: "site-test", publicOrigin: "https://site.example" },
            { days: 7 }
          )
        )
      );
      expect(result._tag === "Failure" && result.failure).toBeInstanceOf(
        GeoTinybirdError
      );
    }
  );

  test("site visitor totals run only the overview query of site analytics", async () => {
    const scope = await seedProject("site-totals");
    const site = {
      ...scope,
      id: "site-test",
      publicOrigin: "https://site.example",
    };
    views = 4;
    const totals = await Effect.runPromise(
      loadSiteVisitorTotals(site, { days: 7 })
    );
    expect(totals.visitors).toBe(4);
    expect(requests).toHaveLength(1);
    const totalsRequests = [...requests];
    requests.length = 0;
    await Effect.runPromise(loadSiteAnalytics(site, { days: 7 }));
    expect(requests).toEqual(expect.arrayContaining(totalsRequests));

    failedQuery = "overview";
    const failed = await Effect.runPromise(
      Effect.result(loadSiteVisitorTotals(site, { days: 7 }))
    );
    expect(failed._tag === "Failure" && failed.failure).toBeInstanceOf(
      GeoTinybirdError
    );
  });

  test("unconfigured site analytics keeps its unavailable signal", async () => {
    const scope = await seedProject("unconfigured-site");
    configured = false;
    const response = await Effect.runPromise(
      loadSiteAnalytics(
        { ...scope, id: "site-test", publicOrigin: "https://site.example" },
        { days: 7 }
      )
    );
    expect(response.web.configured).toBe(false);
    expect(response.web.totals.views).toBe(0);
  });

  test("demo analytics tolerates unsupported web pipes without hiding live failures", async () => {
    const scope = await seedProject("demo-web");
    demo = true;
    const web = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(web.configured).toBe(true);
    expect(web.totals.views).toBe(0);
    expect(web.points).toEqual([]);
    const site = await Effect.runPromise(
      loadSiteAnalytics(
        { ...scope, id: "site-test", publicOrigin: "https://site.example" },
        { days: 7 }
      )
    );
    expect(site.web.configured).toBe(true);
    expect(site.engagement.views).toBe(0);
  });

  test("a project without recorded visitors returns empty analytics, not a tracking flag", async () => {
    const scope = await seedProject("empty-web");
    const response = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(response.totals.views).toBe(0);
    expect(response.hosts).toEqual([]);
    expect(response.pages).toEqual([]);
    expect(response).not.toHaveProperty("tracking");
    expect(response).not.toHaveProperty("trackVisitors");
  });

  test("project analytics add notra.js reports on request; Sites do not", async () => {
    const scope = await seedProject("script-reports");
    const web = await Effect.runPromise(
      loadWebAnalytics(
        scope,
        { days: 7 },
        undefined,
        "",
        undefined,
        "breakdowns",
        { scriptReports: true }
      )
    );
    const lcp = {
      metric: "lcp" as const,
      samples: 4,
      good: 1,
      needsImprovement: 2,
      poor: 1,
    };
    // Unknown metrics are dropped and a missing pipe reads as no errors.
    expect(web.script).toEqual({
      outboundLinks: [
        {
          url: "docs.example.org/start",
          clicks: 2,
          previousClicks: 0,
          visitors: 2,
        },
      ],
      vitals: [{ ...lcp, p75: 1800 }],
      vitalsByDevice: { mobile: [{ ...lcp, p75: 3100 }], desktop: [] },
      errors: [],
      languages: [{ value: "de", visitors: 5, previousVisitors: 2 }],
    });
    const unrequested = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(unrequested).not.toHaveProperty("script");
    const site = await Effect.runPromise(
      loadSiteAnalytics(
        { ...scope, id: "site-test", publicOrigin: "https://site.example" },
        { days: 7 }
      )
    );
    expect(site.web).not.toHaveProperty("script");
  });
}
