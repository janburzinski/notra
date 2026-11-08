import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = {
  websiteId: "dfid_e2e000000000",
  domain: "acme.example.com",
  allowedHostnames: ["app.e2e.example", "shop.e2e.example"],
  disablePayments: true,
  disableConsole: false,
  debug: false,
  allowLocalhost: true,
};

// The data-* options the stand-in reads back, as `dataset` keys.
const options = {
  websiteId: settings.websiteId,
  domain: settings.domain,
  allowedHostnames: "app.e2e.example,shop.e2e.example",
  disablePayments: "true",
  disableConsole: "false",
  debug: "false",
  allowLocalhost: "true",
};

export const datafast: AnalyticsProvider = {
  name: "datafast",
  settings,
  script: "https://datafa.st/js/script.js",
  standIn: "datafast.js",
  endpoint: "https://datafa.st/api/events",
  isLiveAsset: () => false,
  isLiveCollect: (url) =>
    url.hostname === "datafa.st" && url.pathname === "/api/events",
  identifier: settings.websiteId,
  // A page view has type `pageview`; custom events use `custom`.
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as {
      type?: string;
      websiteId?: string;
      href?: string;
    } | null;
    return (
      event.method === "POST" &&
      body?.type === "pageview" &&
      body.websiteId === settings.websiteId &&
      isPageUrl(body.href, page)
    );
  },
  assertEmulated(event, pageUrl) {
    assert.deepEqual(JSON.parse(event.body ?? "null"), {
      type: "pageview",
      websiteId: settings.websiteId,
      domain: settings.domain,
      href: pageUrl,
      options,
    });
  },
};
