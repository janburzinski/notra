import { C15T_ANALYTICS_CATEGORY } from "@notra/sites-core/constants/integrations";
import {
  SITE_ANALYTICS_EVENT_FILE,
  SITE_ENGAGEMENT_VIEW_ID_PATTERN,
} from "@notra/sites-core/constants/sites";
import {
  TRACKER_SCRIPT,
  TRACKER_SCRIPT_VERSION,
} from "@notra/web-tracker/script";

import {
  ANALYTICS_BEACON_PAGE_FIELDS,
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_SCRIPT_CACHE_CONTROL,
  ANALYTICS_SCRIPT_IMMUTABLE_CACHE_CONTROL,
  ANALYTICS_SCRIPT_KEY,
  ANALYTICS_STATUS_PARAM,
} from "./constants/analytics";
import type { AnalyticsScriptTag } from "./types/serving";
import type { AnalyticsBeacon } from "./types/traffic";
import { escapeHtml } from "./utils/html";

export function isAnalyticsEventPath(pathname: string): boolean {
  return pathname.endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`);
}

/**
 * Beacons come from the site's own pages: the worker host, or the customer's
 * origin when the site is reverse-proxied. Anything else is a forged report.
 */
export function isForeignAnalyticsPost(
  request: Request,
  origins: string[]
): boolean {
  // The beacon endpoint is relative, so a real page always posts same-origin;
  // proxied hosts like www vs apex make the Origin list a fallback only.
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null) {
    return fetchSite !== "same-origin";
  }
  const origin = request.headers.get("Origin");
  return origin !== null && !origins.includes(origin);
}

/** notra.js, the same build static.usenotra.com serves, from the Site itself. */
export function analyticsScriptResponse(url: URL): Response {
  return new Response(TRACKER_SCRIPT, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control":
        url.searchParams.get("v") === TRACKER_SCRIPT_VERSION
          ? ANALYTICS_SCRIPT_IMMUTABLE_CACHE_CONTROL
          : ANALYTICS_SCRIPT_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function injectAnalyticsScript(
  response: Response,
  analytics: AnalyticsScriptTag
): Response {
  const consent = analytics.consent
    ? ` type="text/plain" data-c15t-category="${C15T_ANALYTICS_CATEGORY}"`
    : "";
  const src = `${analytics.scriptSrc}?v=${TRACKER_SCRIPT_VERSION}`;
  const api =
    response.status === 404
      ? `${analytics.eventPath}?${ANALYTICS_STATUS_PARAM}=404`
      : analytics.eventPath;
  const tag = `<script${consent} src="${escapeHtml(src)}" data-key="${ANALYTICS_SCRIPT_KEY}" data-api="${escapeHtml(api)}" defer></script>`;
  return new HTMLRewriter()
    .on("body", {
      element(element) {
        element.append(tag, { html: true });
      },
    })
    .transform(response);
}

/**
 * The page and the fields ingest checks itself. Only what the Site replaces
 * (page URL and referrer) is validated here; ingest validates the rest.
 */
function parseBeacon(text: string): AnalyticsBeacon | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const { u, r, v } = body as Record<string, unknown>;
  const page = typeof u === "string" ? URL.parse(u) : null;
  if (
    !page ||
    typeof v !== "string" ||
    !SITE_ENGAGEMENT_VIEW_ID_PATTERN.test(v) ||
    (r !== undefined && typeof r !== "string")
  ) {
    return null;
  }
  const fields: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(body)) {
    if (!ANALYTICS_BEACON_PAGE_FIELDS.has(name)) {
      fields[name] = value;
    }
  }
  return {
    page: `${page.pathname}${page.search}${page.hash}`,
    referrer: r ?? null,
    isPageView: !("o" in body || "x" in body || "t" in body),
    fields,
  };
}

export async function readAnalyticsBeacon(
  request: Request
): Promise<AnalyticsBeacon | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > ANALYTICS_EVENT_MAX_BYTES) {
    return null;
  }
  const text = await request.text().catch(() => "");
  if (text.length === 0 || text.length > ANALYTICS_EVENT_MAX_BYTES) {
    return null;
  }
  return parseBeacon(text);
}
