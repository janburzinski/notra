import { beforeEach, describe, expect, mock, test } from "bun:test";

import { Effect } from "effect";

const projectRows = [
  { id: "proj-old", name: "Acme", websiteUrl: "https://acme.com" },
  { id: "proj-new", name: "Labs", websiteUrl: "https://labs.acme.com" },
].map((project) => ({ ...project, isSample: false }));
const chain = {
  from: () => chain,
  leftJoin: () => chain,
  where: () => chain,
  orderBy: () => Promise.resolve(projectRows),
};
mock.module("@notra/db/drizzle", () => ({ db: { select: () => chain } }));
mock.module("@notra/analytics/tinybird/client", () => ({
  isTinybirdConfigured: () => true,
}));

const trafficSource = (
  source: string,
  visitorType: string,
  visits: number,
  previousVisits: number
) => ({
  source,
  visitorType,
  agent: "",
  category: "",
  confidence: "high",
  visits,
  previousVisits,
  markdownVisits: 0,
  paths: 1,
  lastSeenAt: "2026-11-02 10:00:00",
});

const loadAiTraffic = mock((..._args: unknown[]) =>
  Effect.succeed({
    configured: true,
    totals: { crawler: 30, cited: 4, aiReferral: 6, conversions: null },
    previousConversions: null,
    sources: [
      trafficSource("GPTBot", "crawler", 30, 20),
      trafficSource("chatgpt", "ai_referral", 6, 3),
    ],
    points: [
      { day: "2026-11-02", visitorType: "crawler", visits: 20 },
      { day: "2026-11-01", visitorType: "crawler", visits: 10 },
      { day: "2026-11-02", visitorType: "ai_referral", visits: 6 },
    ],
  })
);
const loadWebAnalytics = mock((..._args: unknown[]) =>
  Effect.succeed({
    outcomes: [],
    script: {
      outboundLinks: [
        { url: "github.com/acme", clicks: 7, previousClicks: 2, visitors: 6 },
      ],
      vitals: [
        {
          metric: "lcp",
          p75: 2100,
          samples: 50,
          good: 40,
          needsImprovement: 8,
          poor: 2,
        },
      ],
      errors: [],
      languages: [],
    },
  })
);

mock.module("@notra/geo-core/geo/programs", () => ({
  loadAiTraffic,
  loadGeoTrafficPages: () => Effect.succeed({ configured: true, pages: [] }),
}));
const loadWebUtm = mock((...args: unknown[]) =>
  Effect.succeed(
    args[5] === "campaign"
      ? [
          { value: "launch", sessions: 9, previousSessions: 3, visitors: 8 },
          { value: ":id", sessions: 2, previousSessions: 0, visitors: 2 },
        ]
      : []
  )
);

mock.module("@notra/geo-core/geo/web-analytics", () => ({
  loadWebAnalytics,
  loadWebUtm,
}));

mock.module("@notra/db/utils/geo-checks", () => ({
  queryGeoCheckOverview: async () => [
    {
      engine: "chatgpt",
      checks: 10,
      mentions: 4,
      mentionRate: 0.4,
      citations: 2,
      visibility: 5,
      visibilityRate: 0.5,
      avgPosition: 2.5,
      lastCheckedAt: new Date("2026-11-02T10:00:00.000Z"),
    },
  ],
  queryGeoCheckCompetitorShare: async () => [{ brand: "Rival", mentions: 3 }],
  queryGeoCheckTimeseries: async () => [],
  toGeoCheckWindow: () => undefined,
}));

const {
  getAiTrafficInputSchema,
  getGeoOverviewInputSchema,
  getWebAnalyticsReportsInputSchema,
} = await import("@notra/tools/schemas/analytics-tools");
const { createGetGeoOverviewTool } =
  await import("@notra/tools/analytics/get-geo-overview");
const { createGetAiTrafficTool } =
  await import("@notra/tools/analytics/get-ai-traffic");
const { createGetWebAnalyticsReportsTool } =
  await import("@notra/tools/analytics/get-web-analytics-reports");

const ctx = {
  session: {
    auth: {
      current: { attributes: { organizationId: "org-1" } },
      initiator: null,
    },
  },
};

type Executable = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
};

beforeEach(() => {
  loadWebAnalytics.mockClear();
  loadWebUtm.mockClear();
});

describe("get_ai_traffic", () => {
  const tool = createGetAiTrafficTool() as unknown as Executable;

  test("reports AI crawler and referral traffic for the default project", async () => {
    const result = (await tool.execute(
      getAiTrafficInputSchema.parse({
        from: "2026-10-27",
        to: "2026-11-02",
        host: "acme.com",
      }),
      ctx
    )) as Record<string, unknown>;

    expect(loadAiTraffic).toHaveBeenCalledWith(
      { organizationId: "org-1", projectId: "proj-old" },
      { from: "2026-10-27", to: "2026-11-02" },
      ["acme.com"]
    );
    expect(result.totals).toMatchObject({
      crawler_visits: 30,
      previous_crawler_visits: 20,
      ai_referral_visits: 6,
      previous_ai_referral_visits: 3,
    });
    expect(result.daily).toEqual([
      { day: "2026-11-01", crawler_visits: 10, ai_referral_visits: 0 },
      { day: "2026-11-02", crawler_visits: 20, ai_referral_visits: 6 },
    ]);
  });

  test("rejects projects outside the organization", async () => {
    expect(
      await tool.execute(
        getAiTrafficInputSchema.parse({ projectId: "proj-other" }),
        ctx
      )
    ).toBe(
      "Project not found in this organization. Call list_geo_projects for valid project IDs."
    );
  });
});

describe("get_geo_overview", () => {
  const tool = createGetGeoOverviewTool() as unknown as Executable;

  test("returns timestamps as ISO strings so eve can serialize the result", async () => {
    const result = await tool.execute(
      getGeoOverviewInputSchema.parse({ days: 7 }),
      ctx
    );

    expect(result).toMatchObject({
      engines: [{ last_checked_at: "2026-11-02T10:00:00.000Z" }],
    });
  });
});

describe("get_web_analytics_reports", () => {
  const tool = createGetWebAnalyticsReportsTool() as unknown as Executable;

  test("returns outbound links and vitals for the chosen project", async () => {
    const result = (await tool.execute(
      getWebAnalyticsReportsInputSchema.parse({
        projectId: "proj-new",
        days: 7,
        path: "/pricing",
      }),
      ctx
    )) as Record<string, unknown>;

    expect(loadWebAnalytics.mock.calls[0]?.[0]).toEqual({
      organizationId: "org-1",
      projectId: "proj-new",
    });
    expect(result.outbound_links).toEqual([
      { url: "github.com/acme", clicks: 7, previous_clicks: 2, visitors: 6 },
    ]);
    expect(result.web_vitals).toMatchObject({
      metrics: [{ metric: "lcp", p75: 2100, samples: 50 }],
    });
  });

  test("returns sessions per UTM parameter, loading every dimension", async () => {
    loadWebUtm.mockClear();
    const result = (await tool.execute(
      getWebAnalyticsReportsInputSchema.parse({
        days: 30,
        host: "acme.com",
        limit: 1,
      }),
      ctx
    )) as { utm: Record<string, unknown> };

    expect(loadWebUtm.mock.calls.map((call) => call[5])).toEqual([
      "source",
      "medium",
      "campaign",
      "term",
      "content",
    ]);
    expect(loadWebUtm.mock.calls[0]?.slice(2, 5)).toEqual([
      "acme.com",
      "",
      undefined,
    ]);
    expect(result.utm).toMatchObject({
      source: [],
      medium: [],
      campaign: [
        { value: "launch", sessions: 9, previous_sessions: 3, visitors: 8 },
      ],
      term: [],
      content: [],
    });
    expect(result.utm.note).toBeString();
  });

  test("validates ranges before querying", async () => {
    expect(
      await tool.execute(
        getWebAnalyticsReportsInputSchema.parse({
          from: "2024-01-01",
          to: "2026-01-01",
        }),
        ctx
      )
    ).toBe("Use a range of 366 days or fewer.");
    expect(loadWebAnalytics).not.toHaveBeenCalled();
    expect(loadWebUtm).not.toHaveBeenCalled();
  });
});
