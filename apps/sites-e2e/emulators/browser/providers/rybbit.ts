import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { jsonOf } from "../utils";

const settings = {
  siteId: "4242",
  skipPatterns: ["/e2e-skipped/**"],
  maskPatterns: ["re:^/e2e-masked/"],
  debounce: 0,
  tag: "e2e",
  replay: {
    sampleRate: 0,
    maskAllInputs: false,
    maskInputOptions: { password: true, tel: true },
    sampling: { mousemove: false, mouseInteraction: { Click: true } },
  },
};

// The data-* options the stand-in reads back, as `dataset` keys.
const options = {
  skipPatterns: '["/e2e-skipped/**"]',
  maskPatterns: '["re:^/e2e-masked/"]',
  debounce: "0",
  tag: "e2e",
  replaySampleRate: "0",
  replayMaskAllInputs: "false",
  replayMaskInputOptions: '{"password":true,"tel":true}',
  replaySampling: '{"mousemove":false,"mouseInteraction":{"Click":true}}',
};

export const rybbit: AnalyticsProvider = {
  name: "rybbit",
  settings,
  script: `https://app.rybbit.io/api/script.js?siteId=${settings.siteId}`,
  standIn: "rybbit.js",
  endpoint: "https://app.rybbit.io/api/track",
  isLiveAsset: (url) =>
    url.hostname === "app.rybbit.io" && url.pathname === "/api/script.js",
  // Rybbit's per-site settings; an empty object keeps the script defaults.
  answerLive: (url) =>
    url.hostname === "app.rybbit.io" &&
    url.pathname === `/api/site/tracking-config/${settings.siteId}`
      ? {}
      : undefined,
  isLiveCollect: (url) =>
    url.hostname === "app.rybbit.io" && url.pathname === "/api/track",
  identifier: settings.siteId,
  // A page view is a `pageview` event; custom events use `custom_event`.
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as {
      type?: string;
      site_id?: string;
      hostname?: string;
      pathname?: string;
      querystring?: string;
    } | null;
    return (
      event.method === "POST" &&
      body?.type === "pageview" &&
      body.site_id === settings.siteId &&
      body.hostname === page.hostname &&
      body.pathname === page.pathname &&
      (body.querystring ?? "") === page.search
    );
  },
  assertEmulated(event, pageUrl) {
    const url = new URL(pageUrl);
    assert.deepEqual(JSON.parse(event.body ?? "null"), {
      type: "pageview",
      site_id: settings.siteId,
      hostname: url.hostname,
      pathname: url.pathname,
      options,
    });
  },
};
