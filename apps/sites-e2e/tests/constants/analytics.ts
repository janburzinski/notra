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
    provider: "ga4",
    url: `https://www.google-analytics.com/g/collect?tid=G-E2E00000&en=page_view&dl=${encodeURIComponent(ANALYTICS_PAGE)}`,
    method: "POST",
    body: null,
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
