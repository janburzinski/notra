import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  WebErrorRow,
  WebEventRow,
  WebPageEngagementRow,
  WebPageViewRow,
} from "@notra/analytics/types/tinybird-datasources";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import { Effect } from "effect";

const STORED = { successful_rows: 1, quarantined_rows: 0 };
const ingestGeoTrafficEvents = mock(async (_rows: unknown[]) => STORED);
const ingestWebPageViews = mock(async (_rows: WebPageViewRow[]) => STORED);
const ingestWebPageEngagement = mock(
  async (_rows: WebPageEngagementRow[]) => STORED
);
const ingestWebEvents = mock(async (_rows: WebEventRow[]) => STORED);
const ingestWebErrors = mock(async (_rows: WebErrorRow[]) => STORED);
const getGeoIngestTokenGeneration = mock(async (): Promise<number | null> => 7);
const getGeoWebKeyGeneration = mock(async (): Promise<number | null> => 0);
const loadIngestAllowedHosts = mock(
  async (_identity?: GeoIngestIdentity): Promise<string[] | null> => [
    "acme.com",
  ]
);
const KEY = "nwk.org_1.proj_1.good";

mock.module("@notra/analytics/tinybird/client", () => ({
  ingestGeoTrafficEvents,
  ingestMcpEvents: ingestGeoTrafficEvents,
  ingestWebPageEngagement,
  ingestWebPageViews,
  ingestWebEvents,
  ingestWebErrors,
}));
mock.module("@notra/geo-core/geo/ingest", () => ({
  verifyGeoWebKey: (key: string): GeoIngestIdentity | null => {
    const [prefix, organizationId, projectId, ...rest] = key.split(".");
    const signature = rest.pop();
    const generation = rest[0] ? Number(rest[0].slice(1)) : 0;
    return prefix === "nwk" &&
      signature === "good" &&
      organizationId &&
      projectId
      ? {
          organizationId,
          projectId,
          generation,
          web: true,
        }
      : null;
  },
  verifyGeoIngestToken: () => null,
  verifyGeoIngestSiteToken: () => null,
  isGeoIngestSiteToken: () => false,
  getGeoIngestTokenGeneration,
  getGeoWebKeyGeneration,
  getGeoIngestSecret: () => "test-secret",
}));
const hasServerTraffic = mock(async () => true);
const aiRatelimit = mock(async () => ({ success: true }));
const webAiLimit = mock(async (_key: string) => ({ success: true }));
const networkLimit = mock(async (_key: string) => ({ success: true }));
const projectLimit = mock(async (_key: string) => ({ success: true }));
const admissionLimit = mock(async (_key: string) => ({ success: true }));
mock.module("../src/ingest/hosts", () => ({ loadIngestAllowedHosts }));
mock.module("../src/ingest/server-traffic", () => ({
  hasServerTraffic,
  markServerTraffic: async () => undefined,
}));
const loadOrganizationSitePrefixes = mock(
  async (_organizationId: string, _recent?: boolean) => [
    { host: "acme.com", mounts: ["/blog"] },
  ]
);
mock.module("../src/ingest/sites", () => ({
  loadIngestSite: async () => null,
  loadOrganizationSitePrefixes,
}));
mock.module("../src/ingest/analytics", () => ({
  trackGeoIngestAnalytics: () => Effect.void,
}));
mock.module("../src/ingest/ratelimit", () => ({
  geoIngestRatelimit: { limit: (_key: string) => aiRatelimit() },
  webIngestRatelimit: { limit: projectLimit },
  geoIngestAdmissionRatelimit: { limit: admissionLimit },
  webNetworkRatelimit: { limit: networkLimit },
  webSharedNetworkRatelimit: { limit: networkLimit },
  webAiRatelimit: { limit: webAiLimit },
  geoIngestRedis: null,
}));
mock.module("@notra/ai/utils/redis", () => ({ redis: null }));
mock.module("@notra/ai/billing/ai-traffic-events", () => ({
  hasAiTrafficEventsQuota: () => Effect.succeed(true),
  trackAiTrafficEvent: async () => true,
}));

// Vercel's edge sets the client IP and country headers the beacon relies on.
const previousVercel = process.env.VERCEL;
process.env.VERCEL = "1";
afterAll(() => {
  process.env.VERCEL = previousVercel;
});

const { runWebCollect } = await import("../src/ingest/collect");
const { handleWebCollectRequest } = await import("../src/ingest/handler");

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const HEADLESS = CHROME.replace("Chrome/", "HeadlessChrome/");
const BROWSER_HEADERS = {
  origin: "https://acme.com",
  "user-agent": CHROME,
  "sec-ch-ua": '"Chromium";v="149"',
  "sec-fetch-mode": "no-cors",
  "x-vercel-forwarded-for": "203.0.113.9",
  "x-vercel-ip-country": "DE",
  "content-type": "text/plain;charset=UTF-8",
};
const VIEW = "abcdefghijklmnopqrstuvwxyz12";

/** A beacon from a browser on acme.com; an empty header value removes it. */
function beacon(body: unknown, headers: Record<string, string> = {}) {
  const request = new Request("https://ingest.test/api/collect", {
    method: "POST",
    headers: { ...BROWSER_HEADERS, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  for (const [name, value] of Object.entries(headers)) {
    if (!value) {
      request.headers.delete(name);
    }
  }
  return request;
}

async function run(
  request: Request,
  options?: Parameters<typeof runWebCollect>[3]
) {
  return Effect.runPromise(
    Effect.result(runWebCollect(request, () => undefined, undefined, options))
  );
}

const send = (
  fields: Record<string, unknown> = {},
  headers?: Record<string, string>,
  options?: Parameters<typeof runWebCollect>[3]
) =>
  run(
    beacon({ k: KEY, v: VIEW, u: "https://acme.com/", ...fields }, headers),
    options
  );

const viewRows = () => ingestWebPageViews.mock.calls.map((call) => call[0][0]);

describe("runWebCollect", () => {
  beforeEach(() => {
    for (const fn of [
      ingestGeoTrafficEvents,
      ingestWebPageViews,
      ingestWebPageEngagement,
      ingestWebEvents,
      ingestWebErrors,
      getGeoIngestTokenGeneration,
    ]) {
      fn.mockClear();
    }
    getGeoIngestTokenGeneration.mockImplementation(async () => 7);
    hasServerTraffic.mockImplementation(async () => true);
    aiRatelimit.mockImplementation(async () => ({ success: true }));
    for (const limit of [
      webAiLimit,
      networkLimit,
      projectLimit,
      admissionLimit,
    ]) {
      limit.mockReset();
      limit.mockImplementation(async () => ({ success: true }));
    }
    aiRatelimit.mockClear();
    loadIngestAllowedHosts.mockImplementation(async () => ["acme.com"]);
  });

  test("records an AI-referred page view as a web visit, without the IP or click ids", async () => {
    const result = await send(
      {
        u: "https://acme.com/pricing/48213?utm_source=newsletter&gclid=Cj0KCQ-secret",
        r: "https://chatgpt.com/",
      },
      { "accept-language": "de-DE,de;q=0.9,en;q=0.8" }
    );
    expect(result._tag).toBe("Success");
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
    // Public keys post on every page view, so their Sites lookup is kept.
    expect(loadOrganizationSitePrefixes.mock.lastCall).toEqual(["org_1", true]);
    const [row] = viewRows();
    expect(row).toMatchObject({
      organization_id: "org_1",
      project_id: "proj_1",
      site_id: "",
      host: "acme.com",
      path: "/pricing/:id",
      referrer_group: "ai",
      utm_source: "newsletter",
      country: "DE",
      device: "desktop",
      browser: "Chrome",
      view_id: VIEW,
      language: "de",
    });
    expect(row?.visitor_id).toHaveLength(16);
    expect(JSON.stringify(row)).not.toMatch(/203\.0\.113\.9|secret/);
  });

  test("keeps hash routes only for data-hash beacons, on views, engagement and events", async () => {
    const u = "https://acme.com/#/pricing?plan=pro";
    await send({ u, h: true });
    await send({ u });
    await send({ u, h: true, t: 1200, s: 40 });
    await send({ u, h: true, o: "docs.acme.com/" });
    expect(viewRows().map((row) => row?.path)).toEqual(["/#/pricing", "/"]);
    expect(ingestWebPageEngagement.mock.calls[0]?.[0][0]?.path).toBe(
      "/#/pricing"
    );
    expect(ingestWebEvents.mock.calls[0]?.[0][0]?.path).toBe("/#/pricing");
  });

  test("records an outbound click as host and scrubbed path with the view's visitor id", async () => {
    await send({ u: "https://acme.com/pricing" });
    await send({
      u: "https://acme.com/pricing?plan=pro",
      o: "docs.example.org/users/jan@example.com/48213?token=abc#top",
    });
    const event = ingestWebEvents.mock.calls[0]?.[0][0];
    expect(event).toMatchObject({
      organization_id: "org_1",
      project_id: "proj_1",
      host: "acme.com",
      path: "/pricing",
      view_id: VIEW,
      name: "Outbound",
      props: '{"url":"docs.example.org/users/:id/:id"}',
      country: "DE",
      device: "desktop",
    });
    expect(event?.visitor_id).toBe(viewRows()[0]?.visitor_id);
    expect(ingestWebPageViews).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a legacy custom event", { e: "Signup", p: { plan: "pro" } }],
    ["an empty outbound link", { o: "" }],
    ["an outbound link over the URL cap", { o: "x".repeat(2049) }],
  ])("stores no event for %s", async (_label, fields) => {
    await send(fields);
    expect(ingestWebEvents).not.toHaveBeenCalled();
  });

  test.each<[string, Record<string, unknown>, Record<string, string>]>([
    [
      "a host outside the project",
      { u: "https://other.com/" },
      { origin: "https://other.com" },
    ],
    [
      "an outbound click on a host outside the project",
      { u: "https://other.com/", o: "docs.acme.com/" },
      { origin: "https://other.com" },
    ],
    ["a page on a Notra Site", { u: "https://acme.com/blog/post" }, {}],
    ["a browser without client hints", {}, { "sec-ch-ua": "" }],
    ["headless Chrome", {}, { "user-agent": HEADLESS }],
    ["Lighthouse", {}, { "user-agent": `${CHROME} Chrome-Lighthouse` }],
    [
      "an outbound click from headless Chrome",
      { o: "docs.acme.com/" },
      { "user-agent": HEADLESS },
    ],
  ])("drops %s", async (_label, fields, headers) => {
    expect(await send(fields, headers)).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(ingestWebEvents).not.toHaveBeenCalled();
  });

  test("a failed host lookup drops public-key beacons instead of accepting any host", async () => {
    loadIngestAllowedHosts.mockImplementation(async () => null);
    for (const fields of [{}, { o: "docs.acme.com/" }]) {
      expect(await send(fields)).toMatchObject({
        success: { outcome: "dropped", reason: "host" },
      });
    }
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(ingestWebEvents).not.toHaveBeenCalled();
  });

  test("scrubs error messages and sources, keeping the source's origin and port, and no stack", async () => {
    await send({
      u: "https://acme.com/account",
      x: "Failed for jan@example.com order 123456 at https://api.acme.com/v1?token=abc",
      xs: "https://acme.com:8443/u/123456/app.js?v=12345#frag",
      xl: 42,
      stack: "Error at secret",
    });
    expect(ingestWebErrors.mock.calls[0]?.[0][0]).toMatchObject({
      path: "/account",
      view_id: VIEW,
      message: "Failed for [email] order # at https://api.acme.com/v1",
      source: "https://acme.com:8443/u/#/app.js",
      line: 42,
      kind: "error",
      browser: "Chrome",
    });
    expect(JSON.stringify(ingestWebErrors.mock.calls[0]?.[0])).not.toContain(
      "secret"
    );
  });

  test("records engagement with web vitals, unset or implausible ones as null", async () => {
    await send({
      u: "https://acme.com/pricing",
      t: 4200,
      s: 63,
      c: 14,
      i: 0,
      l: 1800,
      f: 900,
      b: 0,
    });
    await send({ t: 10, l: 999_999 });
    expect(
      ingestWebPageEngagement.mock.calls.map((call) => call[0][0])
    ).toEqual([
      expect.objectContaining({
        project_id: "proj_1",
        path: "/pricing",
        view_id: VIEW,
        visible_ms: 4200,
        scroll_depth: 63,
        cls_milli: 14,
        inp_ms: null,
        lcp_ms: 1800,
        fcp_ms: 900,
        ttfb_ms: null,
      }),
      expect.objectContaining({
        visible_ms: 10,
        lcp_ms: null,
        cls_milli: null,
      }),
    ]);
  });

  test("without a server SDK, AI referrals feed journeys on the public key's own budget", async () => {
    hasServerTraffic.mockImplementation(async () => false);
    await send({
      u: "https://acme.com/pricing/48213?ntr=Jx8kQ2mZp4Lw",
      r: "https://chatgpt.com/c/6f1d2c-private-thread?model=x",
    });
    expect(ingestGeoTrafficEvents.mock.calls[0]?.[0][0]).toMatchObject({
      organization_id: "org_1",
      visitor_type: "ai_referral",
      path: "/pricing/:id",
      referer: "https://chatgpt.com/",
      journey_id: "n_Jx8kQ2mZp4Lw",
    });
    expect(ingestWebPageViews).toHaveBeenCalledTimes(1);
    expect(aiRatelimit).not.toHaveBeenCalled();
    expect(webAiLimit.mock.calls[0]?.[0]).toBe(
      JSON.stringify(["org_1:proj_1", "web"])
    );

    // Neither a non-AI view nor a spent AI budget adds an event; views stay.
    ingestGeoTrafficEvents.mockClear();
    await send();
    webAiLimit.mockImplementation(async () => ({ success: false }));
    expect(await send({ r: "https://claude.ai/" })).toMatchObject({
      success: { outcome: "ingested" },
    });
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
    expect(ingestWebPageViews).toHaveBeenCalledTimes(3);
  });

  test("another site's page is dropped before any rate limit, one network before the project budget", async () => {
    expect(
      await send({}, { origin: "https://copied-key.example" })
    ).toMatchObject({ success: { outcome: "dropped", reason: "origin" } });
    expect(networkLimit).not.toHaveBeenCalled();

    networkLimit.mockImplementation(async () => ({ success: false }));
    expect(await send()).toMatchObject({
      success: { outcome: "dropped", reason: "network_rate_limited" },
    });
    expect(networkLimit.mock.calls[0]?.[0]).toBe(
      JSON.stringify(["org_1", "proj_1", "203.0.113.9"])
    );
    expect(projectLimit).not.toHaveBeenCalled();
    expect(ingestWebPageViews).not.toHaveBeenCalled();
  });

  test("a malformed beacon spends the public web budget and stops before any database check", async () => {
    projectLimit.mockImplementation(async () => ({ success: false }));
    expect(
      await send({}, { "user-agent": `${CHROME} ${"x".repeat(5000)}` })
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "GeoIngestRateLimited" },
    });
    expect(JSON.parse(projectLimit.mock.calls[0]?.[0] ?? "[]")[0]).toBe("web");
    expect(admissionLimit).not.toHaveBeenCalled();
    expect(getGeoIngestTokenGeneration).not.toHaveBeenCalled();
  });

  test("refuses bodies over 4 KB without reading past the limit", async () => {
    const huge = JSON.stringify({
      k: KEY,
      v: VIEW,
      u: `https://acme.com/${"a".repeat(5000)}`,
    });
    const declared = await run(
      beacon(huge, { "content-length": String(huge.length) })
    );
    const streamed = await run(
      new Request("https://ingest.test/api/collect", {
        method: "POST",
        headers: BROWSER_HEADERS,
        body: new Blob([huge]).stream(),
        duplex: "half",
      } as RequestInit)
    );
    for (const result of [declared, streamed]) {
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "GeoIngestPayloadTooLarge" },
      });
    }
    expect(ingestWebPageViews).not.toHaveBeenCalled();
  });

  test("stores cf-ray only when it is shaped like a Cloudflare ray id", async () => {
    await send({}, { "cf-ray": "forged<script>" });
    await send({}, { "cf-ray": "8f1e2d3c4b5a6978-FRA" });
    expect(viewRows().map((row) => row?.request_id)).toEqual([
      "",
      "8f1e2d3c4b5a6978-FRA",
    ]);
  });

  test("looks the country up in process only when no edge header has it", async () => {
    const lookupCountry = mock((_ip: string) => "FR");
    await send({}, {}, { lookupCountry });
    expect(lookupCountry).not.toHaveBeenCalled();
    await send({}, { "x-vercel-ip-country": "" }, { lookupCountry });
    expect(lookupCountry).toHaveBeenCalledWith("203.0.113.9");
    expect(viewRows().map((row) => row?.country)).toEqual(["DE", "FR"]);
  });

  test("ignores write-token rotation but not deleted projects", async () => {
    getGeoIngestTokenGeneration.mockImplementation(async () => 99);
    await send();
    expect(ingestWebPageViews).toHaveBeenCalledTimes(1);

    // A scope seen active stays trusted for a minute; a fresh one is checked.
    getGeoWebKeyGeneration.mockImplementation(async () => null);
    expect((await send())._tag).toBe("Success");
    expect((await send({ k: "nwk.org_1.proj_gone.good" }))._tag).toBe(
      "Failure"
    );
    getGeoWebKeyGeneration.mockImplementation(async () => 0);
  });

  test("rotating the public key revokes the old one, even right after the new one is seen", async () => {
    getGeoWebKeyGeneration.mockImplementation(async () => 1);
    expect(await send({ k: "nwk.org_1.proj_rot.g1.good" })).toMatchObject({
      success: { outcome: "ingested" },
    });
    expect(await send({ k: "nwk.org_1.proj_rot.good" })).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "GeoIngestInvalidToken", authReason: "token_revoked" },
    });
    getGeoWebKeyGeneration.mockImplementation(async () => 0);
  });

  test.each<[string, unknown, string]>([
    [
      "an unknown key",
      { k: "nwk.org_1.proj_1.bad", v: VIEW, u: "https://acme.com/" },
      "GeoIngestInvalidToken",
    ],
    ["a body that is not JSON", "not json", "GeoIngestInvalidPayload"],
    [
      "a short view id",
      { k: KEY, v: "short", u: "https://acme.com/" },
      "GeoIngestInvalidPayload",
    ],
  ])("rejects %s", async (_label, body, tag) => {
    expect(await run(beacon(body))).toMatchObject({ failure: { _tag: tag } });
  });
});

describe("handleWebCollectRequest", () => {
  test("answers beacons with 204 and errors with CORS headers", async () => {
    const accepted = await handleWebCollectRequest(
      beacon({ k: KEY, v: VIEW, u: "https://acme.com/" }),
      () => undefined
    );
    const rejected = await handleWebCollectRequest(
      beacon({ k: "nwk.x.y.z", v: VIEW, u: "https://acme.com/" }),
      () => undefined
    );
    expect([accepted.status, rejected.status]).toEqual([204, 401]);
    for (const response of [accepted, rejected]) {
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    }
  });
});
