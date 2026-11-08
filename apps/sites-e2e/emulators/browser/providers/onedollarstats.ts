import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { jsonOf } from "../utils";

const settings = {
  hostname: "onedollarstats-e2e.example",
  hashRouting: true,
  props: { source: "e2e", build: "ci" },
};

// The data-* options the stand-in reads back, as `dataset` keys.
const options = {
  hostname: settings.hostname,
  props: "source=e2e;build=ci",
  hashRouting: "",
};

// The real script sends `?data=<base64 JSON>` as an image and falls back to
// a POST with the same JSON when the image fails.
function payloadOf(url: string, body: string | null) {
  const data = new URL(url).searchParams.get("data");
  return jsonOf(data ? Buffer.from(data, "base64").toString("utf8") : body) as {
    u?: string;
    e?: { t?: string }[];
  } | null;
}

export const onedollarstats: AnalyticsProvider = {
  name: "onedollarstats",
  settings,
  script: "https://assets.onedollarstats.com/stonks.js",
  standIn: "onedollarstats.js",
  endpoint: "https://collector.onedollarstats.com/events",
  isLiveAsset: (url) =>
    url.hostname === "assets.onedollarstats.com" &&
    url.pathname === "/stonks.js",
  isLiveCollect: (url) =>
    url.hostname === "collector.onedollarstats.com" &&
    url.pathname === "/events",
  identifier: settings.hostname,
  // OneDollarStats reports the configured hostname and drops the query, so
  // only the path identifies the page.
  isLivePageView: (event, page) => {
    const payload = payloadOf(event.url, event.body);
    return (
      Array.isArray(payload?.e) &&
      payload.e.some((entry) => entry?.t === "PageView") &&
      payload.u ===
        `https://${settings.hostname}${page.pathname}`.replace(/\/$/, "")
    );
  },
  assertEmulated(event, pageUrl) {
    const url = new URL(pageUrl);
    assert.deepEqual(JSON.parse(event.body ?? "null"), {
      u: `https://${settings.hostname}${url.pathname}`.replace(/\/$/, ""),
      e: [{ t: "PageView", h: true }],
      options,
    });
  },
};
