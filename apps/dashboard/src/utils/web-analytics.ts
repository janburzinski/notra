import { WEB_VITAL_THRESHOLDS } from "@notra/analytics/constants/web-vitals";
import type { ImportCoverage } from "@notra/geo-core/types/analytics-imports";
import type {
  GeoTrafficPoint,
  WebAnalyticsPoint,
  WebAnalyticsResponse,
  WebAnalyticsSource,
  WebAnalyticsVital,
  WebVitalMetric,
} from "@notra/geo-core/types/geo";
import {
  formatGeoSource,
  trafficDayKey,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { addDays } from "@notra/geo-core/utils/analytics-import-range";
import { formatDayLabel } from "@notra/geo-core/utils/day-label";
import { trafficLogHostFilter } from "@notra/geo-core/utils/geo-project-domains";

import {
  WEB_SOURCE_LABELS,
  WEB_TABLE_EMPTY_HEIGHT,
  WEB_TABLE_MIN_ROWS,
  WEB_TABLE_ROW_HEIGHT,
  WEB_TREND_AGENTS_KEY,
  WEB_TREND_PEOPLE_KEY,
  WEB_LANGUAGE_FLAG_COUNTRIES,
} from "@/constants/web-analytics";
import type { WebTrendRow, WebTrendShare, WebVitalRating } from "@/types/geo";

export function buildWebTrendRows(
  webPoints: readonly WebAnalyticsPoint[],
  aiPoints: readonly GeoTrafficPoint[],
  locale: string,
  from?: string,
  to?: string
): WebTrendRow[] {
  const people = new Map<string, number>();
  for (const point of webPoints) {
    const day = trafficDayKey(point.day);
    people.set(day, (people.get(day) ?? 0) + point.views);
  }
  const agents = new Map<string, number>();
  for (const point of aiPoints) {
    if (point.visitorType !== "crawler") {
      continue;
    }
    const day = trafficDayKey(point.day);
    agents.set(day, (agents.get(day) ?? 0) + point.visits);
  }
  const days = trafficSparklineDays([...aiPoints, ...webPoints], from, to);
  return days.map((day) => ({
    day: formatDayLabel(day, locale),
    rawDay: day,
    [WEB_TREND_PEOPLE_KEY]: people.get(day) ?? 0,
    [WEB_TREND_AGENTS_KEY]: agents.get(day) ?? 0,
  }));
}

/**
 * The first day Notra tracked after the latest import, when it is on the
 * chart, so the chart can mark where imported history hands over.
 */
export function importStartMarker(
  rows: readonly WebTrendRow[],
  imported: ImportCoverage | null | undefined
): { day: string; provider: ImportCoverage["provider"] } | null {
  if (!imported) {
    return null;
  }
  const firstNativeDay = imported.nativeStart ?? addDays(imported.until, 1);
  const row = rows.find((entry) => entry.rawDay === firstNativeDay);
  return row ? { day: row.day, provider: imported.provider } : null;
}

export function webTrendShare(
  rows: readonly WebTrendRow[]
): WebTrendShare | null {
  let people = 0;
  let agents = 0;
  for (const row of rows) {
    people += row[WEB_TREND_PEOPLE_KEY];
    agents += row[WEB_TREND_AGENTS_KEY];
  }
  const total = people + agents;
  if (total === 0) {
    return null;
  }
  const peopleShare = (people / total) * 100;
  return { people: peopleShare, agents: 100 - peopleShare };
}

export function formatWebShare(share: number): string {
  if (share > 0 && share < 1) {
    return "<1";
  }
  if (share > 99 && share < 100) {
    return ">99";
  }
  return String(Math.round(share));
}

export function webHostsForSelect(
  web: WebAnalyticsResponse | undefined
): string[] {
  const hosts = new Set<string>();
  for (const row of web?.hosts ?? []) {
    const host = trafficLogHostFilter(row.host);
    if (host.length > 0) {
      hosts.add(host);
    }
  }
  return [...hosts];
}

/** Summary response with the breakdown tables filled in once they load. */
export function withWebBreakdowns(
  summary: WebAnalyticsResponse | undefined,
  breakdowns: WebAnalyticsResponse | undefined
): WebAnalyticsResponse | undefined {
  if (!(summary && breakdowns)) {
    return summary;
  }
  return {
    ...summary,
    pages: breakdowns.pages,
    sources: breakdowns.sources,
    countries: breakdowns.countries,
    devices: breakdowns.devices,
    outcomes: breakdowns.outcomes,
    ...(breakdowns.script ? { script: breakdowns.script } : {}),
  };
}

/** Whether any tracked host had page views, even outside the page filter. */
export function hasWebHosts(web: WebAnalyticsResponse | undefined): boolean {
  return (web?.hosts ?? []).some((row) => row.views > 0);
}

export function hasWebAnalytics(
  web: WebAnalyticsResponse | undefined
): boolean {
  return (web?.totals.views ?? 0) > 0;
}

/**
 * Whether the previous period recorded any page view. Without one every
 * comparison would read "New", which says nothing.
 */
export function hasPreviousWebPeriod(
  web: Pick<WebAnalyticsResponse, "totals"> | undefined
): boolean {
  return (web?.totals.previousViews ?? 0) > 0;
}

export function webSourceName(
  source: WebAnalyticsSource,
  directLabel: string
): string {
  if (source.group === "direct") {
    return directLabel;
  }
  if (source.group === "ai") {
    return formatGeoSource(source.source);
  }
  return Object.hasOwn(WEB_SOURCE_LABELS, source.source)
    ? (WEB_SOURCE_LABELS[source.source] ?? source.source)
    : source.source;
}

export function webTableHeight(rowCount: number): number {
  if (rowCount === 0) {
    return WEB_TABLE_EMPTY_HEIGHT;
  }
  return (Math.max(rowCount, WEB_TABLE_MIN_ROWS) + 1) * WEB_TABLE_ROW_HEIGHT;
}

/** Visible time as "42s" or "3m 05s". */
export function formatVisibleDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const minutes = Math.floor(rounded / 60);
  const rest = String(rounded % 60).padStart(2, "0");
  return `${minutes}m ${rest}s`;
}

export function webVitalRating(
  metric: WebVitalMetric,
  p75: number
): WebVitalRating {
  const [good, poor] = webVitalThresholds(metric);
  if (p75 <= good) {
    return "good";
  }
  return p75 > poor ? "poor" : "needs-improvement";
}

/** Good and poor thresholds of a vital, in its stored unit. */
export function webVitalThresholds(
  metric: WebVitalMetric
): readonly [number, number] {
  return WEB_VITAL_THRESHOLDS[metric];
}

function webVitalTimingFormat(value: number, locale: string) {
  const seconds = value >= 1000;
  return {
    format: new Intl.NumberFormat(locale, {
      style: "unit",
      unit: seconds ? "second" : "millisecond",
      unitDisplay: "narrow",
      maximumFractionDigits: seconds ? 1 : 0,
    }),
    value: seconds ? value / 1000 : value,
  };
}

function formatCls(value: number, locale: string): string {
  return (value / 1000).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** A vital for display: CLS as a unitless score, timings in ms or s. */
export function formatWebVital(
  metric: WebVitalMetric,
  value: number,
  locale: string
): string {
  if (metric === "cls") {
    return formatCls(value, locale);
  }
  const { format, value: scaled } = webVitalTimingFormat(value, locale);
  return format.format(scaled);
}

/** The same value split into number and unit, for a large figure with a small unit. */
export function webVitalParts(
  metric: WebVitalMetric,
  value: number,
  locale: string
): { number: string; unit: string } {
  if (metric === "cls") {
    return { number: formatCls(value, locale), unit: "" };
  }
  const { format, value: scaled } = webVitalTimingFormat(value, locale);
  const parts = format.formatToParts(scaled);
  return {
    number: parts
      .filter((part) => part.type !== "unit" && part.type !== "literal")
      .map((part) => part.value)
      .join(""),
    unit: parts
      .filter((part) => part.type === "unit")
      .map((part) => part.value)
      .join(""),
  };
}

/** Start of a threshold band, without its unit when the end has the same one. */
export function formatWebVitalRangeStart(
  metric: WebVitalMetric,
  from: number,
  to: number,
  locale: string
): string {
  const start = webVitalParts(metric, from, locale);
  return start.unit === webVitalParts(metric, to, locale).unit
    ? start.number
    : formatWebVital(metric, from, locale);
}

export function webVitalCounts(
  vital: WebAnalyticsVital
): Record<WebVitalRating, number> {
  return {
    good: vital.good,
    "needs-improvement": vital.needsImprovement,
    poor: vital.poor,
  };
}

/** A rating's share of the views as a whole percent; "<1%" when it rounds away. */
export function webVitalShareLabel(
  count: number,
  total: number,
  locale: string
): string {
  const format = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const share = total > 0 ? count / total : 0;
  if (share > 0 && share < 0.01) {
    return `<${format.format(0.01)}`;
  }
  return format.format(share);
}

/** Country whose flag stands for a browser language, if one is listed. */
export function languageFlagCountry(language: string): string | undefined {
  const code = language.toLowerCase();
  return Object.hasOwn(WEB_LANGUAGE_FLAG_COUNTRIES, code)
    ? WEB_LANGUAGE_FLAG_COUNTRIES[code]
    : undefined;
}

export function languageName(code: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
