import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = { key: "cs_e2e0000000000000000" };

export const capless: AnalyticsProvider = {
  name: "capless",
  settings,
  script: "https://c.capless.sh/c.js",
  standIn: "capless.js",
  endpoint: "https://c.capless.sh/e",
  isLiveAsset: (url) =>
    url.hostname === "c.capless.sh" && url.pathname === "/c.js",
  isLiveCollect: (url) =>
    url.hostname === "c.capless.sh" && url.pathname === "/e",
  identifier: settings.key,
  // A batch of `[type, time, url, props]` events, keyed by the URL's `k`.
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as { e?: unknown } | null;
    return (
      event.method === "POST" &&
      new URL(event.url).searchParams.get("k") === settings.key &&
      Array.isArray(body?.e) &&
      body.e.some(
        (entry) =>
          Array.isArray(entry) &&
          entry[0] === "pageview" &&
          isPageUrl(entry[2], page)
      )
    );
  },
  assertEmulated(event, pageUrl) {
    assert.equal(new URL(event.url).searchParams.get("k"), settings.key);
    assert.deepEqual(JSON.parse(event.body ?? "null"), {
      e: [["pageview", pageUrl]],
    });
  },
};
