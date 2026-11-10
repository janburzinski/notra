import {
  TRAFFIC_EMBED_CHARTS,
  TRAFFIC_EMBED_DEFAULT_CHARTS,
} from "@notra/schemas/constants/dashboard/traffic-embed";

import {
  TRAFFIC_EMBED_DATA_PATH_PREFIX,
  TRAFFIC_EMBED_DEFAULT_HEIGHT,
  TRAFFIC_EMBED_DEFAULT_RANGE,
  TRAFFIC_EMBED_ID_LENGTH,
  TRAFFIC_EMBED_PATH_PREFIX,
  TRAFFIC_EMBED_RANGES,
  TRAFFIC_EMBED_SANDBOX,
} from "../constants/traffic-embed";
import type {
  TrafficEmbedChart,
  TrafficEmbedOriginResult,
  TrafficEmbedRequestContext,
  TrafficEmbedPart,
  TrafficEmbedRange,
  TrafficEmbedTheme,
} from "../types/traffic-embed";

const EMBED_ID_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${TRAFFIC_EMBED_ID_LENGTH}}$`
);
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//;
const WILDCARD_PREFIX = "*.";
const WILDCARD_PLACEHOLDER = "notra-wildcard.";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// The URL parser lets through characters like ";" that would end the CSP
// directive, so hostnames are held to DNS labels.
const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const EMBED_THEMES = new Set<TrafficEmbedTheme>(["light", "dark", "auto"]);
const EMBED_PARTS = ["metrics", "chart"] as const satisfies TrafficEmbedPart[];

export function isTrafficEmbedId(value: string): boolean {
  return EMBED_ID_PATTERN.test(value);
}

/** The embed id when `pathname` is an embed page, otherwise null. */
export function trafficEmbedIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(TRAFFIC_EMBED_PATH_PREFIX)) {
    return null;
  }
  const id = pathname.slice(TRAFFIC_EMBED_PATH_PREFIX.length).split("/")[0];
  return id && isTrafficEmbedId(id) ? id : null;
}

export function isTrafficEmbedPath(pathname: string): boolean {
  return pathname.startsWith(TRAFFIC_EMBED_PATH_PREFIX);
}

/**
 * Turns what a user types ("example.com", "https://blog.example.com/",
 * "*.example.com", "http://localhost:3000") into a CSP host source. Plain
 * http is only accepted for loopback hosts, so a framing page can't be
 * swapped on the network; paths, queries and credentials are rejected.
 */
export function normalizeTrafficEmbedOrigin(
  input: string
): TrafficEmbedOriginResult {
  const value = input.trim().toLowerCase();
  if (!value || value === "*" || /\s/.test(value)) {
    return { ok: false, value: input };
  }
  const withScheme = SCHEME_PATTERN.test(value) ? value : `https://${value}`;
  const schemeEnd = withScheme.indexOf("://") + "://".length;
  const wildcard = withScheme.slice(schemeEnd).startsWith(WILDCARD_PREFIX);
  const parseable = wildcard
    ? `${withScheme.slice(0, schemeEnd)}${WILDCARD_PLACEHOLDER}${withScheme.slice(schemeEnd + WILDCARD_PREFIX.length)}`
    : withScheme;

  let url: URL;
  try {
    url = new URL(parseable);
  } catch {
    return { ok: false, value: input };
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  const hasExtras =
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/";
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && loopback);
  const bareHost = wildcard
    ? url.hostname.slice(WILDCARD_PLACEHOLDER.length)
    : url.hostname;
  const isDomain =
    loopback || (bareHost.includes(".") && HOSTNAME_PATTERN.test(bareHost));
  if (hasExtras || !secure || !isDomain || (wildcard && loopback)) {
    return { ok: false, value: input };
  }

  const host = wildcard
    ? url.host.replace(WILDCARD_PLACEHOLDER, WILDCARD_PREFIX)
    : url.host;
  return { ok: true, origin: `${url.protocol}//${host}` };
}

/**
 * Whether an origin ("https://blog.example.com") matches an allowed entry,
 * with the same rules as frame-ancestors: exact scheme and host, a
 * "*." prefix for subdomains only, and the port only where one is listed.
 */
export function trafficEmbedOriginAllowed(
  origin: string,
  allowedOrigins: readonly string[]
): boolean {
  return allowedOrigins.some((allowed) => {
    const schemeEnd = allowed.indexOf("://") + "://".length;
    if (!allowed.slice(schemeEnd).startsWith(WILDCARD_PREFIX)) {
      return allowed === origin;
    }
    const scheme = allowed.slice(0, schemeEnd);
    const suffix = `.${allowed.slice(schemeEnd + WILDCARD_PREFIX.length)}`;
    if (!origin.startsWith(scheme)) {
      return false;
    }
    const host = origin.slice(scheme.length);
    return host.endsWith(suffix) && host.length > suffix.length;
  });
}

function originOf(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Whether a request may see an embed. Browsers set these headers themselves,
 * so a page can't fake them.
 *
 * - The embed page only loads inside a frame (`Sec-Fetch-Dest: iframe`),
 *   never when the link is opened directly or in a new tab. When the browser
 *   says who framed it (Referer), that site must be allowed (or the
 *   dashboard's own preview). frame-ancestors then stops any other site from
 *   showing it.
 * - Its data only answers the embed page's own polls: same-origin fetches.
 *
 * Browsers without Fetch Metadata fall back to the Referer; with neither,
 * the request is refused.
 */
export function trafficEmbedRequestAllowed(
  request: TrafficEmbedRequestContext,
  allowedOrigins: readonly string[]
): boolean {
  const refererOrigin = originOf(request.referer);
  if (request.kind === "data") {
    if (request.site !== null) {
      return (
        request.site === "same-origin" &&
        (request.dest === null || request.dest === "empty")
      );
    }
    return refererOrigin === request.selfOrigin;
  }
  if (request.dest !== null && request.dest !== "iframe") {
    return false;
  }
  if (refererOrigin !== null) {
    return (
      refererOrigin === request.selfOrigin ||
      trafficEmbedOriginAllowed(refererOrigin, allowedOrigins)
    );
  }
  return request.dest === "iframe";
}

/** The request facts `trafficEmbedRequestAllowed` needs. */
export function trafficEmbedRequestContext(
  kind: TrafficEmbedRequestContext["kind"],
  url: string,
  headers: { get(name: string): string | null }
): TrafficEmbedRequestContext {
  return {
    kind,
    dest: headers.get("sec-fetch-dest"),
    site: headers.get("sec-fetch-site"),
    referer: headers.get("referer"),
    selfOrigin: new URL(url).origin,
  };
}

/** `'self'` keeps the preview in the dashboard's embed dialog working. */
export function trafficEmbedFrameAncestors(origins: readonly string[]): string {
  return ["'self'", ...origins].join(" ");
}

function isTrafficEmbedRange(value: unknown): value is TrafficEmbedRange {
  return (
    typeof value === "string" &&
    (TRAFFIC_EMBED_RANGES as readonly string[]).includes(value)
  );
}

export function trafficEmbedRange(value: unknown): TrafficEmbedRange {
  return isTrafficEmbedRange(value) ? value : TRAFFIC_EMBED_DEFAULT_RANGE;
}

export function trafficEmbedTheme(value: unknown): TrafficEmbedTheme {
  return typeof value === "string" &&
    EMBED_THEMES.has(value as TrafficEmbedTheme)
    ? (value as TrafficEmbedTheme)
    : "auto";
}

/** Unknown or empty `parts` fall back to the whole card. */
export function trafficEmbedParts(value: unknown): TrafficEmbedPart[] {
  if (typeof value !== "string") {
    return [...EMBED_PARTS];
  }
  const requested = new Set(value.split(",").map((part) => part.trim()));
  const parts = EMBED_PARTS.filter((part) => requested.has(part));
  return parts.length === 0 ? [...EMBED_PARTS] : parts;
}

/**
 * Stored charts in page order. Values this build doesn't know are dropped,
 * so a newer or hand-edited row can't put an unknown chart on the page.
 */
export function storedTrafficEmbedCharts(
  values: readonly string[] | null | undefined
): TrafficEmbedChart[] {
  const stored = new Set(values ?? []);
  const charts = TRAFFIC_EMBED_CHARTS.filter((chart) => stored.has(chart));
  return charts.length === 0 ? [...TRAFFIC_EMBED_DEFAULT_CHARTS] : charts;
}

/**
 * The URL's `charts`, limited to the ones the embed allows. A missing, empty
 * or unknown list shows every allowed chart; the URL can never add one.
 */
export function trafficEmbedCharts(
  value: unknown,
  allowed: readonly TrafficEmbedChart[]
): TrafficEmbedChart[] {
  if (typeof value !== "string") {
    return [...allowed];
  }
  const requested = new Set(value.split(",").map((chart) => chart.trim()));
  const charts = allowed.filter((chart) => requested.has(chart));
  return charts.length === 0 ? [...allowed] : charts;
}

export function trafficEmbedUrl(
  origin: string,
  id: string,
  options: {
    range: TrafficEmbedRange;
    theme: TrafficEmbedTheme;
    parts: readonly TrafficEmbedPart[];
    /** Omit to show every chart the embed allows. */
    charts?: readonly TrafficEmbedChart[];
    locale?: string;
  }
): string {
  const url = new URL(`${TRAFFIC_EMBED_PATH_PREFIX}${id}`, origin);
  if (options.range !== TRAFFIC_EMBED_DEFAULT_RANGE) {
    url.searchParams.set("range", options.range);
  }
  if (options.theme !== "auto") {
    url.searchParams.set("theme", options.theme);
  }
  if (options.parts.length < EMBED_PARTS.length) {
    url.searchParams.set("parts", options.parts.join(","));
  }
  if (options.charts && options.charts.length > 0) {
    url.searchParams.set("charts", options.charts.join(","));
  }
  if (options.locale) {
    url.searchParams.set("locale", options.locale);
  }
  return url.toString();
}

/**
 * The JSON a live embed polls. Only range and charts change the numbers, so
 * theme and locale stay out and every display of an embed shares one CDN
 * entry.
 */
export function trafficEmbedDataUrl(
  id: string,
  search: { range?: string; charts?: string }
): string {
  const params = new URLSearchParams();
  if (search.range) {
    params.set("range", search.range);
  }
  if (search.charts) {
    params.set("charts", search.charts);
  }
  const query = params.toString();
  return `${TRAFFIC_EMBED_DATA_PATH_PREFIX}${id}${query ? `?${query}` : ""}`;
}

/**
 * The iframe works on its own at a fixed height; the script only listens for
 * the page's resize messages so the frame grows with its content.
 */
export function trafficEmbedSnippet(
  origin: string,
  src: string,
  title: string
): string {
  return [
    "<iframe",
    `  src="${src}"`,
    `  title="${title.replaceAll('"', "&quot;")}"`,
    "  data-notra-embed",
    '  width="100%"',
    `  height="${TRAFFIC_EMBED_DEFAULT_HEIGHT}"`,
    `  sandbox="${TRAFFIC_EMBED_SANDBOX}"`,
    '  style="border:0;width:100%"',
    '  loading="lazy"',
    "></iframe>",
    `<script src="${origin}/embed.js" async></script>`,
  ].join("\n");
}
