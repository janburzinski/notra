import type {
  PublicAiTrafficChart,
  PublicAiTrafficSnapshot,
} from "@notra/schemas/types/api/public-ai-traffic";

import { DATA_PURPOSE_LABELS, DATA_VENDOR_DOMAINS } from "@/constants/data";
import type {
  DataPageModel,
  DataShareSegment,
  DataTraffic,
  DataTrafficRow,
  DataTrendValue,
} from "@/types/data";

const PERCENT = 100;
/** Key of the "Other" slice in share bars and charts. */
export const OTHER_KEY = "other";
const REGIONAL_INDICATOR_A = 0x1f1e6;
const LETTER_A = 65;

/** 0.1234 → "12.3%"; shares under 1% keep two decimals so they don't read as zero. */
export function formatShare(value: number | null): string {
  if (value === null) {
    return "–";
  }
  const percent = value * PERCENT;
  if (percent > 0 && percent < 1) {
    return `${percent.toFixed(2)}%`;
  }
  return `${percent.toFixed(1)}%`;
}

/** Whole-percent change, signed; null reads as "New". */
export function formatChange(value: number | null): string {
  if (value === null) {
    return "New";
  }
  const percent = Math.round(value * PERCENT);
  if (percent === 0) {
    return "0%";
  }
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent).toLocaleString("en")}%`;
}

export function formatVisits(value: number): string {
  if (value >= 100) {
    return Math.round(value).toLocaleString("en");
  }
  return value.toLocaleString("en", { maximumFractionDigits: 1 });
}

/** 1234.5 → "1,235 : 1" */
export function formatRatio(value: number | null): string {
  if (value === null) {
    return "–";
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en")} : 1`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const CHART_DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDataDay(day: string): string {
  return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

function formatChartDay(day: string): string {
  return CHART_DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

export function vendorDomain(vendor: string | null): string | null {
  if (!vendor) {
    return null;
  }
  return Object.hasOwn(DATA_VENDOR_DOMAINS, vendor)
    ? (DATA_VENDOR_DOMAINS[vendor] ?? null)
    : null;
}

/** Relative week-over-week change, e.g. 0.123 → 12%. Null when new. */
export function relativeTrend(change: number | null): DataTrendValue {
  if (change === null) {
    return { value: null, signed: "New" };
  }
  return { value: Math.round(change * PERCENT), signed: formatChange(change) };
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "DE" → 🇩🇪, from the two regional indicator symbols. */
export function countryFlag(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (char) => REGIONAL_INDICATOR_A - LETTER_A + char.charCodeAt(0)
    )
  );
}

const RECENT_DAYS = 7;
const TOTAL_KEY = "total";

function windowTotals(rows: readonly DataTrafficRow[]): number[] {
  return rows.flatMap((row) => (row.total === null ? [] : [row.total]));
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

/** Chart rows for one kind: the day's total plus a key per bot or assistant. */
function trafficChart(
  chart: PublicAiTrafficChart,
  sources: readonly { label: string; vendor: string | null }[]
): DataTraffic {
  const vendors = new Map(sources.map((row) => [row.label, row.vendor]));
  const series = chart.series
    .filter((entry) => entry.key !== TOTAL_KEY)
    .map((entry) =>
      entry.key === OTHER_KEY
        ? { key: `s_${entry.key}`, label: "Other", domain: null }
        : {
            key: `s_${entry.key}`,
            label: entry.label,
            domain: vendorDomain(vendors.get(entry.label) ?? entry.label),
          }
    );
  const rows = chart.days.map((entry) => {
    const values = Object.values(entry.values);
    // A group withheld by the privacy floor leaves the day's total unknown;
    // counting it as zero would read as a drop.
    const complete =
      values.length > 0 && values.every((value) => value !== null);
    const row: DataTrafficRow = {
      day: formatChartDay(entry.day),
      rawDay: entry.day,
      total: complete
        ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : null,
    };
    for (const [key, value] of Object.entries(entry.values)) {
      row[`s_${key}`] = value;
    }
    return row;
  });
  // Windows are calendar days, so a day blanked by the privacy floor leaves
  // a gap instead of pulling older days into "this week".
  const recent = average(windowTotals(rows.slice(-RECENT_DAYS)));
  const before = average(
    windowTotals(rows.slice(-RECENT_DAYS * 2, -RECENT_DAYS))
  );
  return {
    rows,
    series,
    recent,
    change: recent !== null && before ? recent / before - 1 : null,
  };
}

const SHARE_SEGMENTS = 5;

/** Shares grouped by company, the largest few plus "Other". */
function vendorSegments(
  rows: readonly { vendor: string | null; share: number }[]
): DataShareSegment[] {
  const byVendor = new Map<string, number>();
  for (const row of rows) {
    const vendor = row.vendor ?? OTHER_KEY;
    byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + row.share);
  }
  const sorted = [...byVendor]
    .filter(([vendor]) => vendor !== OTHER_KEY)
    .toSorted((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, SHARE_SEGMENTS).map(([vendor, share]) => ({
    key: vendor,
    label: vendor,
    domain: vendorDomain(vendor),
    share,
  }));
  const rest = 1 - shown.reduce((sum, row) => sum + row.share, 0);
  return rest > 0.001
    ? [...shown, { key: OTHER_KEY, label: "Other", domain: null, share: rest }]
    : shown;
}

/** Trims the daily snapshot to what the page shows. Runs on the server. */
export function buildDataPage(
  snapshot: PublicAiTrafficSnapshot | null
): DataPageModel | null {
  if (!snapshot?.available) {
    return null;
  }
  return {
    day: snapshot.day,
    generatedAt: snapshot.generatedAt,
    windowFrom: snapshot.window.from,
    minSites: snapshot.minSites,
    summary: snapshot.summary,
    traffic: {
      crawlers: trafficChart(snapshot.crawlerVolume, snapshot.crawlers),
      referrals: trafficChart(snapshot.referrerVolume, snapshot.referrers),
    },
    crawlers: snapshot.crawlers.map((row) => ({
      id: row.id,
      label: row.label,
      vendor: row.vendor,
      purpose: row.purpose,
      share: row.share,
      dailyPerSite: row.dailyPerSite,
      reach: row.reach,
      change: row.change,
      markdownShare: row.markdownShare,
      llmsTxtReach: row.llmsTxtReach ?? null,
    })),
    assistants: snapshot.referrers.map((row) => ({
      id: row.id,
      label: row.label,
      vendor: row.vendor,
      share: row.share,
      change: row.change,
      pagesPerVisit: row.pagesPerVisit ?? null,
      multiPageShare: row.multiPageShare ?? null,
    })),
    companies: snapshot.vendors
      .map((row) => ({
        vendor: row.vendor,
        domain: vendorDomain(row.vendor),
        crawlShare: row.crawlShare,
        referralShare: snapshot.referrers
          .filter((referrer) => referrer.vendor === row.vendor)
          .reduce((sum, referrer) => sum + referrer.share, 0),
        crawlsPerReferral: row.crawlsPerReferral,
      }))
      .toSorted((a, b) => b.crawlShare - a.crawlShare),
    shares: {
      crawls: vendorSegments(snapshot.crawlers),
      referrals: vendorSegments(snapshot.referrers),
      purposes: snapshot.purposes.map((row) => ({
        key: row.purpose,
        label: DATA_PURPOSE_LABELS[row.purpose] ?? row.purpose,
        domain: null,
        share: row.share,
      })),
    },
    purposes: snapshot.purposes.map((row) => ({
      purpose: row.purpose,
      share: row.share,
      change:
        row.previousShare && row.previousShare > 0
          ? row.share / row.previousShare - 1
          : null,
    })),
    countries: (snapshot.countries ?? []).map((row) => ({
      country: row.country,
      name: countryName(row.country),
      share: row.share,
      change: row.change,
    })),
    agentFiles: snapshot.crawlers
      .flatMap((row) =>
        typeof row.llmsTxtReach === "number" && row.markdownShare !== null
          ? [
              {
                id: row.id,
                label: row.label,
                vendor: row.vendor,
                llmsTxtReach: row.llmsTxtReach,
                markdownShare: row.markdownShare,
              },
            ]
          : []
      )
      .toSorted((a, b) => b.llmsTxtReach - a.llmsTxtReach),
    hours: snapshot.hours ?? null,
  };
}
