import type { CollectedEvent } from "../../emulators/browser/types";

export const ANALYTICS_PAGE = "http://acme.localhost:4321/blog/hello-world";

// Real SDK wire formats, not the stand-ins' deliberately simpler payloads.
export const LIVE_PAGE_VIEWS: CollectedEvent[] = [
  {
    provider: "capless",
    url: "https://c.capless.sh/e?k=cs_e2e0000000000000000",
    method: "POST",
    body: JSON.stringify({
      c: { a: "anon", s: "session", v: "0.1.4" },
      e: [["pageview", 0, ANALYTICS_PAGE, { n: "load", t: "Hello" }]],
    }),
    at: 0,
  },
  {
    provider: "databuddy",
    url: "https://basket.databuddy.cc/batch?client_id=e2e_databuddy_client",
    method: "POST",
    body: JSON.stringify([{ name: "screen_view", path: ANALYTICS_PAGE }]),
    at: 0,
  },
  {
    provider: "datafast",
    url: "https://datafa.st/api/events",
    method: "POST",
    body: JSON.stringify({
      websiteId: "dfid_e2e000000000",
      domain: "acme.example.com",
      href: ANALYTICS_PAGE,
      referrer: null,
      viewport: { width: 1280, height: 720 },
      visitorId: "00000000-0000-4000-8000-000000000000",
      sessionId: "s00000000-0000-4000-8000-000000000000",
      visitorFirstSeenAt: "2026-11-08T00:00:00.000Z",
      visitorSessionNumber: 1,
      language: "en-US",
      timezone: "UTC",
      screenWidth: 1280,
      screenHeight: 720,
      type: "pageview",
    }),
    at: 0,
  },
  {
    provider: "ga4",
    url: `https://www.google-analytics.com/g/collect?tid=G-E2E00000&en=page_view&dl=${encodeURIComponent(ANALYTICS_PAGE)}`,
    method: "POST",
    body: null,
    at: 0,
  },
  {
    provider: "onedollarstats",
    url: "https://collector.onedollarstats.com/events",
    method: "POST",
    body: JSON.stringify({
      u: `https://onedollarstats-e2e.example${new URL(ANALYTICS_PAGE).pathname}`,
      e: [{ t: "PageView", h: true }],
      debug: false,
    }),
    at: 0,
  },
  {
    provider: "plausible",
    url: "https://plausible.io/api/event",
    method: "POST",
    body: JSON.stringify({
      n: "pageview",
      d: "acme.example.com",
      u: ANALYTICS_PAGE,
    }),
    at: 0,
  },
  {
    provider: "posthog",
    url: "https://us.i.posthog.com/i/v0/e/",
    method: "POST",
    body: JSON.stringify({
      event: "$pageview",
      properties: {
        token: "phc_synthetic0000000000000000",
        $current_url: ANALYTICS_PAGE,
      },
    }),
    at: 0,
  },
  {
    provider: "rybbit",
    url: "https://app.rybbit.io/api/track",
    method: "POST",
    body: JSON.stringify({
      site_id: "4242",
      hostname: new URL(ANALYTICS_PAGE).hostname,
      pathname: new URL(ANALYTICS_PAGE).pathname,
      querystring: "",
      screenWidth: 1280,
      screenHeight: 720,
      language: "en-US",
      page_title: "Hello",
      referrer: "",
      type: "pageview",
      event_name: "",
    }),
    at: 0,
  },
  {
    provider: "simpleAnalytics",
    url: `https://queue.simpleanalyticscdn.com/simple.gif?version=12&hostname=acme.example.com&https=false&timezone=Europe%2FBerlin&sri=false&type=pageview&src=https%3A%2F%2Fscripts.simpleanalyticscdn.com%2Flatest.js&k=&metadata=%7B%22type%22%3A%22pageview%22%2C%22path%22%3A%22${encodeURIComponent(new URL(ANALYTICS_PAGE).pathname)}%22%7D&path=${encodeURIComponent(new URL(ANALYTICS_PAGE).pathname)}&unique=true&hostname_original=${encodeURIComponent(new URL(ANALYTICS_PAGE).host)}&time=0`,
    method: "GET",
    body: null,
    at: 0,
  },
  {
    provider: "umami",
    url: "https://gateway.umami.is/api/send",
    method: "POST",
    body: JSON.stringify({
      type: "event",
      payload: {
        website: "00000000-0000-4000-8000-000000000001",
        url: ANALYTICS_PAGE,
      },
    }),
    at: 0,
  },
];
