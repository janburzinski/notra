import { createHmac } from "node:crypto";

import { redis } from "@notra/ai/utils/redis";
import type {
  WebErrorRow,
  WebEventRow,
  WebPageEngagementRow,
  WebPageViewRow,
} from "@notra/analytics/types/tinybird-datasources";
import { toClickHouseDateTime } from "@notra/analytics/utils/datetime";
import { GEO_INGEST_RATELIMIT_TIMEOUT_MS } from "@notra/geo-core/constants/ingest";
import {
  ISO_DATE_LENGTH,
  WEB_AI_PRODUCTS,
  WEB_ANDROID_APP_REFERRERS,
  WEB_BROWSERS,
  WEB_LANGUAGE_PATTERN,
  WEB_MAIL_HOSTS,
  WEB_OPERATING_SYSTEMS,
  WEB_OUTBOUND_EVENT,
  WEB_RETURN_HOSTS,
  WEB_SEARCH_HOSTS,
  WEB_SEARCH_SUFFIX_PATTERN,
  WEB_SESSION_KEY_PREFIX,
  WEB_SESSION_TTL_SECONDS,
  WEB_SOCIAL_HOSTS,
  WEB_UTM_MAX_LENGTH,
  WEB_VISITOR_ID_LENGTH,
  WEB_VITAL_CLS_MAX_MILLI,
  WEB_VITAL_INP_MAX_MS,
  WEB_VITAL_TIMING_MAX_MS,
} from "@notra/geo-core/constants/web-analytics";
import { WEB_SESSION_RESOLVE_SCRIPT } from "@notra/geo-core/constants/web-session";
import { getGeoIngestSecret } from "@notra/geo-core/geo/ingest";
import { urlHost } from "@notra/geo-core/utils/url-host";
import { SITE_ENGAGEMENT_MAX_VISIBLE_MS } from "@notra/sites-core/constants/sites";
import type { Redis } from "@upstash/redis";

import type {
  WebEngagementInput,
  WebErrorInput,
  WebEventInput,
  WebPageViewInput,
  WebReferrer,
  WebSession,
} from "../types/ingest";
import { androidAppPackage } from "../utils/android-app-referrer";
import { scrubWebErrorText, scrubWebText } from "../utils/web-error-scrub";
import { isHumanPageView, webPagePath } from "../utils/web-page-view";
import { scrubWebPath } from "../utils/web-path-scrub";
import { scrubWebUtmText } from "../utils/web-utm";
import { resolveAiReferrer } from "./classify-visitor";
import { dailySalt } from "./daily-salt";

const LEADING_WWW_REGEX = /^www\./;
const QUERY_OR_FRAGMENT_REGEX = /[?#].*$/;
const TRAILING_DOT_REGEX = /\.$/;

export async function webVisitorId(
  scope: string,
  ip: string | undefined,
  userAgent: string | undefined,
  capturedAt: Date
): Promise<string | null> {
  if (!getGeoIngestSecret()) {
    return null;
  }
  const salt = await dailySalt(
    capturedAt.toISOString().slice(0, ISO_DATE_LENGTH)
  );
  return createHmac("sha256", salt)
    .update(`${scope}|${ip ?? ""}|${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, WEB_VISITOR_ID_LENGTH);
}

/** The day's visitor id, per Site, else per project, else per organization. */
function visitorIdOf({
  identity,
  payload,
  capturedAt,
}: Pick<WebPageViewInput, "identity" | "payload" | "capturedAt">) {
  return webVisitorId(
    identity.site?.id ?? identity.projectId ?? identity.organizationId,
    payload.ip,
    payload.userAgent,
    capturedAt
  );
}

/** The columns every web datasource row starts with. */
function webRowBase({
  identity,
  url,
  capturedAt,
  hashRoutes,
}: Pick<WebPageViewInput, "identity" | "url" | "capturedAt" | "hashRoutes">) {
  return {
    organization_id: identity.organizationId,
    project_id: identity.projectId ?? "",
    site_id: identity.site?.id ?? "",
    captured_at: toClickHouseDateTime(capturedAt),
    // `example.com.` is the same site as `example.com` (the allowlist
    // already treats it so); one spelling keeps its stats in one place.
    host: url.hostname.toLowerCase().replace(TRAILING_DOT_REGEX, ""),
    path: webPagePath(url, hashRoutes),
  };
}

const createSessionScript = (client: Redis) =>
  client.createScript<[string, number]>(WEB_SESSION_RESOLVE_SCRIPT);
let sessionScript: ReturnType<typeof createSessionScript> | undefined;

async function resolveSession(
  visitorId: string,
  origin: string | null
): Promise<WebSession> {
  const client = redis;
  const id = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, WEB_VISITOR_ID_LENGTH);
  if (!client) {
    return { id, index: 0 };
  }
  const key = `${WEB_SESSION_KEY_PREFIX}:${visitorId}`;
  // `EVALSHA`, then `EVAL` once when Redis does not have the script yet.
  sessionScript ??= createSessionScript(client);
  // Bounded like the rate limit: the client retries with backoff for
  // seconds, which held every beacon open while Redis was slow.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const session = await Promise.race([
    sessionScript
      .exec([key], [id, origin ?? "", String(WEB_SESSION_TTL_SECONDS)])
      .catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(resolve, GEO_INGEST_RATELIMIT_TIMEOUT_MS, null);
    }),
  ]).finally(() => clearTimeout(timer));
  return session ? { id: session[0], index: session[1] } : { id, index: 0 };
}

/** Whether `host` is `domain` or one of its subdomains. */
function isOnDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function matchHost(host: string, table: Record<string, string>): string | null {
  for (const [pattern, name] of Object.entries(table)) {
    if (pattern.endsWith(".")) {
      // `google.` is Google on any country domain, and only there: the part
      // after it must be a public suffix, not `google.evil.example`.
      const at = host.startsWith(pattern)
        ? 0
        : host.lastIndexOf(`.${pattern}`) + 1;
      if (
        (at > 0 || host.startsWith(pattern)) &&
        WEB_SEARCH_SUFFIX_PATTERN.test(host.slice(at + pattern.length))
      ) {
        return name;
      }
    } else if (isOnDomain(host, pattern)) {
      return name;
    }
  }
  return null;
}

export function classifyWebReferrer(
  referer: string | undefined,
  pageHost: string,
  aiSource: string | null
): WebReferrer {
  const host = referer ? (urlHost(referer) ?? "") : "";
  if (aiSource) {
    return {
      host,
      group: "ai",
      source: aiSource,
      aiProduct: WEB_AI_PRODUCTS[aiSource] ?? aiSource,
    };
  }
  if (!host) {
    return { host: "", group: "direct", source: "", aiProduct: "" };
  }
  const app = androidAppPackage(referer);
  if (app) {
    const known = WEB_ANDROID_APP_REFERRERS[app];
    return {
      host,
      group: known?.group ?? "other",
      source: known?.source ?? app,
      aiProduct: "",
    };
  }
  const bare = host.replace(LEADING_WWW_REGEX, "");
  if (bare === pageHost.replace(LEADING_WWW_REGEX, "")) {
    return { host, group: "internal", source: "", aiProduct: "" };
  }
  if (WEB_RETURN_HOSTS.some((domain) => isOnDomain(bare, domain))) {
    return { host, group: "direct", source: "", aiProduct: "" };
  }
  const mail = matchHost(bare, WEB_MAIL_HOSTS);
  if (mail) {
    return { host, group: "other", source: mail, aiProduct: "" };
  }
  const search = matchHost(bare, WEB_SEARCH_HOSTS);
  if (search) {
    return { host, group: "search", source: search, aiProduct: "" };
  }
  const social = matchHost(bare, WEB_SOCIAL_HOSTS);
  if (social) {
    return { host, group: "social", source: social, aiProduct: "" };
  }
  return { host, group: "other", source: bare, aiProduct: "" };
}

function firstMatch(
  userAgent: string,
  table: readonly [string, string][],
  fallback: string
): string {
  for (const [fragment, name] of table) {
    if (userAgent.includes(fragment)) {
      return name;
    }
  }
  return fallback;
}

export function describeUserAgent(raw: string | undefined) {
  const userAgent = raw?.toLowerCase() ?? "";
  let device = "desktop";
  if (userAgent.includes("ipad") || userAgent.includes("tablet")) {
    device = "tablet";
  } else if (userAgent.includes("mobi") || userAgent.includes("iphone")) {
    device = "mobile";
  }
  return {
    device,
    browser: firstMatch(userAgent, WEB_BROWSERS, "Other"),
    os: firstMatch(userAgent, WEB_OPERATING_SYSTEMS, "Other"),
  };
}

/** Primary language subtag of an Accept-Language header, lowercased; "" if none. */
export function webLanguage(acceptLanguage: string | undefined): string {
  return (
    WEB_LANGUAGE_PATTERN.exec(acceptLanguage ?? "")?.[1]?.toLowerCase() ?? ""
  );
}

/**
 * A script URL as stored: its origin (port included) as sent, its path
 * scrubbed like a message, and no query or fragment.
 */
function scrubWebErrorSource(source: string): string {
  const url = URL.parse(source);
  if (url && url.origin !== "null") {
    return url.origin + scrubWebErrorText(url.pathname);
  }
  return scrubWebErrorText(source.replace(QUERY_OR_FRAGMENT_REGEX, ""));
}

export async function buildWebPageView(
  input: WebPageViewInput
): Promise<WebPageViewRow | null> {
  if (!isHumanPageView(input)) {
    return null;
  }
  const { payload, url, classification } = input;
  const visitorId = await visitorIdOf(input);
  if (!visitorId) {
    return null;
  }
  const params = url.searchParams;
  // Source and medium are scrubbed like the free-text tags: links tagged per
  // recipient put emails and ids in any of them.
  const utmSource = scrubWebUtmText(params.get("utm_source"))
    .slice(0, WEB_UTM_MAX_LENGTH)
    .toLowerCase();
  // ChatGPT's apps send no referrer but tag links with utm_source=chatgpt.com.
  const aiSource =
    classification.visitorType === "ai_referral"
      ? classification.source
      : resolveAiReferrer(utmSource ? `https://${utmSource}` : undefined);
  const referrer = classifyWebReferrer(
    payload.referer,
    url.hostname.toLowerCase().replace(TRAILING_DOT_REGEX, ""),
    aiSource
  );
  // Tags count only on arrival: going back to a tagged URL inside the site
  // (an SPA's back button) continues the visit instead of opening a session.
  const fromOutside =
    referrer.group !== "internal" &&
    (utmSource.length > 0 || referrer.group !== "direct");
  const session =
    payload.status === 404
      ? { id: "", index: 0 }
      : await resolveSession(
          visitorId,
          fromOutside
            ? `${utmSource}|${referrer.group}|${referrer.source}`
            : null
        );
  const agent = describeUserAgent(payload.userAgent);
  return {
    ...webRowBase(input),
    status: payload.status ?? 200,
    visitor_id: visitorId,
    session_id: session.id,
    session_page_index: session.index,
    referrer_host: referrer.host,
    referrer_group: referrer.group,
    referrer_source: referrer.source,
    ai_product: referrer.aiProduct,
    utm_source: utmSource,
    utm_medium: scrubWebUtmText(params.get("utm_medium"))
      .slice(0, WEB_UTM_MAX_LENGTH)
      .toLowerCase(),
    utm_campaign: scrubWebUtmText(params.get("utm_campaign")),
    utm_term: scrubWebUtmText(params.get("utm_term")),
    utm_content: scrubWebUtmText(params.get("utm_content")),
    country: payload.geo?.country ?? "",
    device: agent.device,
    browser: agent.browser,
    os: agent.os,
    request_id: payload.requestId ?? "",
    view_id: input.viewId ?? "",
    language: webLanguage(payload.acceptLanguage),
  };
}

export function isWebBeaconRelayBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    body.type === "beacon"
  );
}

export function buildWebEngagementRow(
  input: WebEngagementInput
): WebPageEngagementRow {
  const { payload } = input;
  return {
    ...webRowBase(input),
    view_id: payload.viewId,
    visible_ms: Math.min(payload.visibleMs, SITE_ENGAGEMENT_MAX_VISIBLE_MS),
    scroll_depth: payload.scrollDepth,
    lcp_ms: vital(payload.lcpMs, WEB_VITAL_TIMING_MAX_MS),
    fcp_ms: vital(payload.fcpMs, WEB_VITAL_TIMING_MAX_MS),
    ttfb_ms: vital(payload.ttfbMs, WEB_VITAL_TIMING_MAX_MS),
    inp_ms: vital(payload.inpMs, WEB_VITAL_INP_MAX_MS),
    // No layout shift is a real (perfect) score; the others are unset at 0.
    cls_milli:
      payload.clsMilli === undefined ||
      payload.clsMilli > WEB_VITAL_CLS_MAX_MILLI
        ? null
        : payload.clsMilli,
  };
}

/** Null for a vital the browser did not measure (0) or an implausible value. */
function vital(value: number | undefined, max: number): number | null {
  return value && value <= max ? value : null;
}

/**
 * `host/path` of an outbound link with no query or fragment, ids in the path
 * replaced and emails scrubbed. The path is scrubbed segment by segment
 * first, so an email in it cannot swallow the host and the segments before it.
 */
function scrubOutboundUrl(url: string): string {
  const bare = url.replace(QUERY_OR_FRAGMENT_REGEX, "");
  const slash = bare.indexOf("/");
  return scrubWebText(
    slash < 0
      ? bare
      : `${bare.slice(0, slash)}${scrubWebPath(bare.slice(slash))}`
  );
}

export async function buildWebEventRow(
  input: WebEventInput
): Promise<WebEventRow | null> {
  const { payload, outboundUrl, viewId } = input;
  const visitorId = await visitorIdOf(input);
  if (!visitorId) {
    return null;
  }
  return {
    ...webRowBase(input),
    view_id: viewId,
    visitor_id: visitorId,
    name: WEB_OUTBOUND_EVENT,
    props: JSON.stringify({ url: scrubOutboundUrl(outboundUrl) }),
    country: payload.geo?.country ?? "",
    device: describeUserAgent(payload.userAgent).device,
  };
}

export function buildWebErrorRow(input: WebErrorInput): WebErrorRow {
  const { payload, viewId, error } = input;
  return {
    ...webRowBase(input),
    view_id: viewId,
    message: scrubWebErrorText(error.message),
    source: scrubWebErrorSource(error.source),
    line: error.line,
    // Promise rejections carry no line; script errors from a file always do.
    kind: error.line > 0 ? "error" : "rejection",
    browser: describeUserAgent(payload.userAgent).browser,
  };
}
