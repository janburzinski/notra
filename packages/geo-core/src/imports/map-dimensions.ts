import {
  IMPORT_BROWSER_FRAGMENTS,
  IMPORT_DEVICE_NAMES,
  IMPORT_DIRECT_NAMES,
  IMPORT_MAX_PATH_LENGTH,
  IMPORT_NO_COUNTRY,
  IMPORT_OS_FRAGMENTS,
  IMPORT_REFERRER_NAMES,
  IMPORT_UNKNOWN_VALUES,
} from "../constants/analytics-imports";
import {
  WEB_AI_PRODUCTS,
  WEB_UTM_MAX_LENGTH,
} from "../constants/web-analytics";
import { resolveAiReferrer } from "../ingest/classify-visitor";
import { classifyWebReferrer } from "../ingest/web";
import type {
  ImportReferrer,
  ImportReferrerInput,
  WebImportDimension,
} from "../types/analytics-imports";
import { scrubWebUtmText } from "../utils/web-utm";

const SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const HOST_REGEX = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const LEADING_WWW_REGEX = /^www\./;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

function toUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(SCHEME_REGEX.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Reads a provider's columns into the record fields they map to. */
export function readImportDimensions(
  columns: Readonly<Partial<Record<string, WebImportDimension>>>,
  read: (column: string) => string
): Partial<Record<WebImportDimension, string>> {
  const fields: Partial<Record<WebImportDimension, string>> = {};
  for (const [column, field] of Object.entries(columns)) {
    if (field) {
      fields[field] = read(column);
    }
  }
  return fields;
}

/** Lowercased hostname without scheme, port, path or trailing dot; "" if not a host. */
export function normalizeImportHost(value: string | undefined): string {
  const url = value ? toUrl(value) : null;
  const host = url?.hostname.toLowerCase().replace(/\.$/, "") ?? "";
  return HOST_REGEX.test(host) ? host : "";
}

/** Path without query string or fragment, as native ingest stores url.pathname. */
export function sanitizeImportPath(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "/";
  }
  const withoutQuery = raw.split(/[?#]/, 1)[0] ?? "";
  const path = SCHEME_REGEX.test(withoutQuery)
    ? (toUrl(withoutQuery)?.pathname ?? "/")
    : withoutQuery;
  const rooted = path.startsWith("/") ? path : `/${path}`;
  return rooted.slice(0, IMPORT_MAX_PATH_LENGTH);
}

export function normalizeImportUtm(value: string | undefined): string {
  return (value ?? "").trim().slice(0, WEB_UTM_MAX_LENGTH).toLowerCase();
}

/** Campaign, term or content, scrubbed like the ones notra.js records. */
export function normalizeImportCampaign(value: string | undefined): string {
  return scrubWebUtmText(value);
}

function fromName(name: string): ImportReferrer | null {
  const known = IMPORT_REFERRER_NAMES[name];
  if (!known) {
    return null;
  }
  return {
    host: "",
    group: known.group,
    source: known.source,
    aiProduct:
      known.group === "ai"
        ? (WEB_AI_PRODUCTS[known.source] ?? known.source)
        : "",
  };
}

function aiFromUrl(url: URL | null): string | null {
  return url ? resolveAiReferrer(url.href) : null;
}

/**
 * Classifies an imported referrer exactly like native ingest: AI hosts and
 * AI-tagged links first, then the referrer host, then campaign and display names.
 */
export function mapImportReferrer(input: ImportReferrerInput): ImportReferrer {
  const pageHost = normalizeImportHost(input.pageHost);
  const referrerUrl = normalizeImportHost(input.referrer)
    ? toUrl(input.referrer ?? "")
    : null;
  const utmSource = normalizeImportUtm(input.utmSource);
  const utmUrl =
    utmSource && normalizeImportHost(utmSource) ? toUrl(utmSource) : null;
  const aiSource = aiFromUrl(referrerUrl) ?? aiFromUrl(utmUrl);
  const host = referrerUrl?.hostname.toLowerCase() ?? "";
  if (aiSource || host) {
    const classified = classifyWebReferrer(
      host ? `https://${host}` : undefined,
      pageHost,
      aiSource
    );
    return {
      host: classified.host,
      group: classified.group as ImportReferrer["group"],
      source: classified.source,
      aiProduct: classified.aiProduct,
    };
  }
  if (utmSource) {
    return (
      fromName(utmSource) ?? {
        host: "",
        group: "other",
        source: utmSource.replace(LEADING_WWW_REGEX, ""),
        aiProduct: "",
      }
    );
  }
  const name = (input.sourceName ?? "").trim().toLowerCase();
  if (IMPORT_DIRECT_NAMES.has(name)) {
    return { host: "", group: "direct", source: "", aiProduct: "" };
  }
  if (normalizeImportHost(name)) {
    return mapImportReferrer({ referrer: name, pageHost: input.pageHost });
  }
  return (
    fromName(name) ?? { host: "", group: "other", source: name, aiProduct: "" }
  );
}

export function mapImportDevice(value: string | undefined): string {
  return IMPORT_DEVICE_NAMES[(value ?? "").trim().toLowerCase()] ?? "";
}

function firstFragment(
  value: string | undefined,
  table: readonly [string, string][]
): string {
  const name = (value ?? "").trim().toLowerCase();
  if (IMPORT_UNKNOWN_VALUES.has(name)) {
    return "";
  }
  return table.find(([fragment]) => name.includes(fragment))?.[1] ?? "Other";
}

export function mapImportBrowser(value: string | undefined): string {
  return firstFragment(value, IMPORT_BROWSER_FRAGMENTS);
}

export function mapImportOs(value: string | undefined): string {
  return firstFragment(value, IMPORT_OS_FRAGMENTS);
}

export function mapImportCountry(value: string | undefined): string {
  const code = (value ?? "").trim().toUpperCase();
  return COUNTRY_REGEX.test(code) && !IMPORT_NO_COUNTRY.has(code) ? code : "";
}
