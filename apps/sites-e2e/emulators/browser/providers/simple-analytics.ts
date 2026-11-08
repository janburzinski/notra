import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";

const settings = {
  hostname: "acme.example.com",
  collectDnt: false,
  strictUtm: true,
  ignorePages: ["/e2e-ignored/*"],
  allowParams: ["e2e"],
  nonUniqueHostnames: ["app.acme.example.com"],
  ignoreMetrics: ["useragent"],
  pings: [1, 30],
  namespace: "sa",
};

// The data-* options the stand-in reads back, as `dataset` keys.
const options = {
  hostname: "acme.example.com",
  collectDnt: "false",
  strictUtm: "true",
  ignorePages: "/e2e-ignored/*",
  allowParams: "e2e",
  nonUniqueHostnames: "app.acme.example.com",
  ignoreMetrics: "useragent",
  pings: "1,30",
  namespace: "sa",
};

export const simpleAnalytics: AnalyticsProvider = {
  name: "simpleAnalytics",
  settings,
  script: "https://scripts.simpleanalyticscdn.com/latest.js",
  standIn: "simple-analytics.js",
  endpoint: "https://queue.simpleanalyticscdn.com/simple.gif",
  isLiveAsset: (url) =>
    url.hostname === "scripts.simpleanalyticscdn.com" &&
    url.pathname === "/latest.js",
  isLiveCollect: (url) => url.hostname === "queue.simpleanalyticscdn.com",
  identifier: settings.hostname,
  // Page views are GET /simple.gif?type=pageview; events use type=event.
  isLivePageView: (event, page) => {
    const url = new URL(event.url);
    const params = url.searchParams;
    return (
      event.method === "GET" &&
      url.pathname === "/simple.gif" &&
      params.get("type") === "pageview" &&
      params.get("hostname") === settings.hostname &&
      params.get("path") === page.pathname &&
      (params.get("hostname_original") ?? params.get("hostname")) === page.host
    );
  },
  assertEmulated(event, pageUrl) {
    const params = new URL(event.url).searchParams;
    assert.deepEqual(
      {
        type: params.get("type"),
        hostname: params.get("hostname"),
        path: params.get("path"),
        options: JSON.parse(params.get("options") ?? "null"),
      },
      {
        type: "pageview",
        hostname: settings.hostname,
        path: new URL(pageUrl).pathname,
        options,
      }
    );
  },
};
