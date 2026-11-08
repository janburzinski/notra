import type {
  GeoImportedDailyRow,
  WebImportedDailyRow,
} from "@notra/analytics/types/tinybird-datasources";
import { classifyUserAgent } from "@usenotra/geo/classify";

import { IMPORT_SCANNER_PATH_PATTERN } from "../constants/analytics-imports";
import type {
  GeoImportRecord,
  ImportRowContext,
  WebImportRecord,
} from "../types/analytics-imports";
import { isInImportHostScope } from "../utils/analytics-import-host";
import {
  mapImportBrowser,
  mapImportCountry,
  mapImportDevice,
  mapImportOs,
  mapImportReferrer,
  normalizeImportCampaign,
  normalizeImportHost,
  normalizeImportUtm,
  sanitizeImportPath,
} from "./map-dimensions";

const WEB_METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "bounces",
  "visit_duration_s",
  "entrances",
] as const;

function count(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
}

function hostAllowed(host: string, allowed: readonly string[] | undefined) {
  if (!allowed || allowed.length === 0) {
    return true;
  }
  return allowed.some((domain) => isInImportHostScope(host, domain));
}

/** Maps one provider record to a Tinybird row; only the grain's dimensions are set. */
export function toWebImportedRow(
  record: WebImportRecord,
  context: ImportRowContext
): WebImportedDailyRow {
  const reported = normalizeImportHost(record.host);
  // A site that moved domains reports its old hostname; keep its history
  // under the host the import was mapped to.
  const host =
    reported && hostAllowed(reported, context.allowedHosts)
      ? reported
      : context.host;
  const usesPath = record.grain === "page" || record.grain === "entry_page";
  const usesSource = record.grain === "source" || record.grain === "campaign";
  const referrer = usesSource
    ? mapImportReferrer({
        referrer: record.referrer,
        utmSource: record.utmSource,
        sourceName: record.sourceName,
        pageHost: host,
      })
    : null;
  return {
    organization_id: context.organizationId,
    project_id: context.projectId,
    site_id: context.siteId,
    import_id: context.importId,
    source_provider: context.provider,
    grain: record.grain,
    day: record.day,
    host,
    path: usesPath ? sanitizeImportPath(record.path) : "",
    referrer_host: referrer?.host ?? "",
    referrer_group: referrer?.group ?? "",
    referrer_source: referrer?.source ?? "",
    ai_product: referrer?.aiProduct ?? "",
    utm_source: usesSource ? normalizeImportUtm(record.utmSource) : "",
    utm_medium: usesSource ? normalizeImportUtm(record.utmMedium) : "",
    utm_campaign: usesSource ? normalizeImportCampaign(record.utmCampaign) : "",
    utm_term: usesSource ? normalizeImportCampaign(record.utmTerm) : "",
    utm_content: usesSource ? normalizeImportCampaign(record.utmContent) : "",
    country: record.grain === "country" ? mapImportCountry(record.country) : "",
    device: record.grain === "device" ? mapImportDevice(record.device) : "",
    browser: record.grain === "browser" ? mapImportBrowser(record.browser) : "",
    os: record.grain === "os" ? mapImportOs(record.os) : "",
    visitors: count(record.visitors),
    visits: count(record.visits),
    pageviews: count(record.pageviews) ?? 0,
    bounces: count(record.bounces),
    visit_duration_s: count(record.visitDurationS),
    entrances: count(record.entrances),
    imported_at: context.importedAt,
  };
}

function webKey(row: WebImportedDailyRow): string {
  return [
    row.grain,
    row.day,
    row.host,
    row.path,
    row.referrer_host,
    row.referrer_group,
    row.referrer_source,
    row.utm_source,
    row.utm_medium,
    row.utm_campaign,
    row.utm_term,
    row.utm_content,
    row.country,
    row.device,
    row.browser,
    row.os,
  ].join("\u0000");
}

function addNullable(left: number | null, right: number | null) {
  return left === null && right === null ? null : (left ?? 0) + (right ?? 0);
}

/** Merges rows whose dimensions collapsed during mapping (e.g. stripped query strings). */
export function aggregateWebRows(
  rows: Iterable<WebImportedDailyRow>
): WebImportedDailyRow[] {
  const merged = new Map<string, WebImportedDailyRow>();
  for (const row of rows) {
    const key = webKey(row);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }
    for (const metric of WEB_METRICS) {
      if (metric === "pageviews") {
        existing.pageviews += row.pageviews;
      } else {
        existing[metric] = addNullable(existing[metric], row[metric]);
      }
    }
  }
  return [...merged.values()];
}

/** Maps a CDN log aggregate to an AI crawler row, or null for humans and scanners. */
export function toGeoImportedRow(
  record: GeoImportRecord,
  context: ImportRowContext
): GeoImportedDailyRow | null {
  const match = classifyUserAgent(record.userAgent);
  if (!match) {
    return null;
  }
  const host = normalizeImportHost(record.host) || context.host;
  if (!hostAllowed(host, context.allowedHosts)) {
    return null;
  }
  const path = sanitizeImportPath(record.path);
  if (IMPORT_SCANNER_PATH_PATTERN.test(path)) {
    return null;
  }
  return {
    organization_id: context.organizationId,
    project_id: context.projectId,
    site_id: context.siteId,
    import_id: context.importId,
    source_provider: context.provider,
    day: record.day,
    visitor_type: "crawler",
    source: match.agent,
    agent: match.agent,
    category: match.category,
    confidence: match.confidence,
    verified: record.verified ? 1 : 0,
    host,
    path,
    status: record.status,
    requests: count(record.requests) ?? 0,
    sample_interval: record.sampleInterval,
    imported_at: context.importedAt,
  };
}

export function aggregateGeoRows(
  rows: Iterable<GeoImportedDailyRow>
): GeoImportedDailyRow[] {
  const merged = new Map<string, GeoImportedDailyRow>();
  for (const row of rows) {
    const key = [
      row.day,
      row.source,
      row.host,
      row.path,
      row.status,
      row.verified,
    ].join("\u0000");
    const existing = merged.get(key);
    if (existing) {
      const total = existing.requests + row.requests;
      existing.sample_interval =
        total > 0
          ? (existing.sample_interval * existing.requests +
              row.sample_interval * row.requests) /
            total
          : existing.sample_interval;
      existing.requests = total;
    } else {
      merged.set(key, { ...row });
    }
  }
  return [...merged.values()];
}

export function inImportRange(day: string, start: string, end: string) {
  return day >= start && day <= end;
}

export function* batches<T>(rows: readonly T[], size: number): Generator<T[]> {
  for (let index = 0; index < rows.length; index += size) {
    yield rows.slice(index, index + size);
  }
}
