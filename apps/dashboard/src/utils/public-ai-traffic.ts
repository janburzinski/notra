import { shiftDay } from "@notra/analytics/utils/demo-pipe";
import { geoHiddenSourceParams } from "@notra/geo-core/geo/hidden-sources";
import {
  formatGeoSource,
  geoAgentVendor,
} from "@notra/geo-core/utils/ai-traffic";
import type {
  PublicAiTrafficChart,
  PublicAiTrafficPurpose,
  PublicAiTrafficSnapshot,
  PublicAiTrafficSource,
  PublicAiTrafficVendor,
} from "@notra/schemas/types/api/public-ai-traffic";

import {
  PUBLIC_DATA_CHART_CRAWLERS,
  PUBLIC_DATA_CHART_REFERRERS,
  PUBLIC_DATA_CHART_VENDORS,
  PUBLIC_DATA_MIN_SITES,
  PUBLIC_DATA_MIN_TOTAL_SITES,
  PUBLIC_DATA_OTHER_KEY,
  PUBLIC_DATA_PURPOSES,
  PUBLIC_DATA_RATIO_WEEKS,
  PUBLIC_DATA_RECENT_DAYS,
  PUBLIC_DATA_REFERRER_VENDORS,
  PUBLIC_DATA_SHARE_DECIMALS,
  PUBLIC_DATA_SITE_CAP_FACTOR,
  PUBLIC_DATA_TOP_CRAWLERS,
  PUBLIC_DATA_TOP_REFERRERS,
  PUBLIC_DATA_TRAINING_PURPOSE,
  PUBLIC_DATA_WINDOW_DAYS,
} from "@/constants/public-data";
import type {
  PublicAiTrafficDailyRow,
  PublicAiTrafficInput,
  PublicAiTrafficKind,
  PublicAiTrafficProjectRow,
  PublicAiTrafficSourceTotals,
  PublicAiTrafficWindow,
} from "@/types/public-data";

const PURPOSES: readonly string[] = PUBLIC_DATA_PURPOSES.map(
  (entry) => entry.purpose
);
/** Heuristic sources (headless browsers, Markdown requests) the dashboard hides too. */
const HIDDEN_SOURCES = new Set(
  geoHiddenSourceParams().excluded_sources.split(",")
);

/** The windows a snapshot published on `today` (UTC) covers, all ending yesterday. */
export function publicAiTrafficWindow(today: string): PublicAiTrafficWindow {
  return {
    from: shiftDay(today, -PUBLIC_DATA_WINDOW_DAYS),
    to: shiftDay(today, -1),
    toExclusive: today,
    recentFrom: shiftDay(today, -PUBLIC_DATA_RECENT_DAYS),
  };
}

function toKind(value: string): PublicAiTrafficKind | null {
  return value === "crawler" || value === "ai_referral" ? value : null;
}

function sourceId(kind: PublicAiTrafficKind, source: string): string {
  return `${kind}:${source}`;
}

function round(value: number, decimals = PUBLIC_DATA_SHARE_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ratio(part: number, total: number): number | null {
  return total > 0 ? round(part / total) : null;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function referrerVendor(source: string): string | null {
  const key = source.trim().toLowerCase();
  return Object.hasOwn(PUBLIC_DATA_REFERRER_VENDORS, key)
    ? (PUBLIC_DATA_REFERRER_VENDORS[key] ?? null)
    : null;
}

function sourceVendor(kind: PublicAiTrafficKind, source: string) {
  return kind === "crawler" ? geoAgentVendor(source) : referrerVendor(source);
}

function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    days.push(day);
  }
  return days;
}

/**
 * Each row's visits after the site cap the daily pipe applies per day
 * (`site_cap_factor`), here per source and week: at most
 * `PUBLIC_DATA_SITE_CAP_FACTOR` times the median site, then at most all other
 * sites together. A source seen on one site alone counts for nothing.
 */
function cappedVisits(rows: PublicAiTrafficProjectRow[]): number[] {
  const groups = new Map<string, number[]>();
  for (const [index, row] of rows.entries()) {
    if (row.visits <= 0) {
      continue;
    }
    const key = `${row.visitor_type}|${row.source}|${row.weeks_ago}`;
    const members = groups.get(key) ?? [];
    members.push(index);
    groups.set(key, members);
  }
  const capped = rows.map((row) => Math.max(row.visits, 0));
  for (const members of groups.values()) {
    const limit =
      PUBLIC_DATA_SITE_CAP_FACTOR *
      median(members.map((index) => capped[index] ?? 0));
    const bounded = members.map((index) => Math.min(capped[index] ?? 0, limit));
    const total = bounded.reduce((sum, visits) => sum + visits, 0);
    for (const [position, index] of members.entries()) {
      const visits = bounded[position] ?? 0;
      capped[index] = Math.min(visits, total - visits);
    }
  }
  return capped;
}

/** Per source: visits and sites in the recent week, the week before, and the ratio window. */
function sourceTotals(
  rows: PublicAiTrafficProjectRow[]
): Map<string, PublicAiTrafficSourceTotals> {
  const capped = cappedVisits(rows);
  const activeRecent = new Set<string>();
  const activePrevious = new Set<string>();
  for (const row of rows) {
    if (row.visits <= 0) {
      continue;
    }
    if (row.weeks_ago === 0) {
      activeRecent.add(row.project_id);
    } else if (row.weeks_ago === 1) {
      activePrevious.add(row.project_id);
    }
  }

  const totals = new Map<string, PublicAiTrafficSourceTotals>();
  for (const [index, row] of rows.entries()) {
    const kind = toKind(row.visitor_type);
    if (!kind || row.visits <= 0) {
      continue;
    }
    // Membership (reach, matched sites) counts every site; sums use the cap.
    const visits = capped[index] ?? 0;
    const id = sourceId(kind, row.source);
    const entry = totals.get(id) ?? {
      id,
      kind,
      source: row.source,
      recent: 0,
      previous: 0,
      matchedRecent: 0,
      matchedPrevious: 0,
      ratioVisits: 0,
      recentSites: new Map<string, number>(),
      previousSites: new Set<string>(),
      matchedRecentSites: new Set<string>(),
      matchedPreviousSites: new Set<string>(),
      ratioSites: new Set<string>(),
    };
    // Change compares only sites measured in both weeks, so a customer
    // installing the tracker doesn't read as a crawler surge.
    const matched =
      activeRecent.has(row.project_id) && activePrevious.has(row.project_id);
    if (row.weeks_ago === 0) {
      entry.recent += visits;
      entry.recentSites.set(
        row.project_id,
        (entry.recentSites.get(row.project_id) ?? 0) + visits
      );
      if (matched) {
        entry.matchedRecent += visits;
        entry.matchedRecentSites.add(row.project_id);
      }
    } else if (row.weeks_ago === 1) {
      entry.previous += visits;
      entry.previousSites.add(row.project_id);
      if (matched) {
        entry.matchedPrevious += visits;
        entry.matchedPreviousSites.add(row.project_id);
      }
    }
    if (row.weeks_ago < PUBLIC_DATA_RATIO_WEEKS) {
      entry.ratioVisits += visits;
      entry.ratioSites.add(row.project_id);
    }
    totals.set(id, entry);
  }
  return totals;
}

/** Distinct sites behind a kind's figures in the ratio window. */
function kindSites(
  totals: Iterable<PublicAiTrafficSourceTotals>,
  kind: PublicAiTrafficKind
): number {
  const sites = new Set<string>();
  for (const entry of totals) {
    if (entry.kind === kind) {
      for (const site of entry.ratioSites) {
        sites.add(site);
      }
    }
  }
  return sites.size;
}

/** Sites per crawler that asked for Markdown in the last 7 days. */
function recentMarkdownSites(
  rows: PublicAiTrafficProjectRow[]
): Map<string, Set<string>> {
  const sites = new Map<string, Set<string>>();
  for (const row of rows) {
    if (
      row.visitor_type !== "crawler" ||
      row.weeks_ago !== 0 ||
      row.markdown_visits <= 0
    ) {
      continue;
    }
    const id = sourceId("crawler", row.source);
    const set = sites.get(id) ?? new Set<string>();
    set.add(row.project_id);
    sites.set(id, set);
  }
  return sites;
}

function kindTotal(
  totals: Iterable<PublicAiTrafficSourceTotals>,
  kind: PublicAiTrafficKind,
  pick: (entry: PublicAiTrafficSourceTotals) => number
): number {
  let sum = 0;
  for (const entry of totals) {
    if (entry.kind === kind) {
      sum += pick(entry);
    }
  }
  return sum;
}

function leaderboard({
  totals,
  kind,
  limit,
  activeSites,
  categories,
  markdown,
  markdownSites,
}: {
  totals: PublicAiTrafficSourceTotals[];
  kind: PublicAiTrafficKind;
  limit: number;
  activeSites: number;
  categories: Map<string, string>;
  markdown: Map<string, { visits: number; markdown: number }>;
  markdownSites: Map<string, Set<string>>;
}): PublicAiTrafficSource[] {
  const recentTotal = kindTotal(totals, kind, (entry) => entry.recent);
  const previousTotal = kindTotal(totals, kind, (entry) => entry.previous);
  return totals
    .filter(
      (entry) =>
        entry.kind === kind && entry.recentSites.size >= PUBLIC_DATA_MIN_SITES
    )
    .toSorted((a, b) => b.recent - a.recent)
    .slice(0, limit)
    .map((entry) => {
      const md = markdown.get(entry.id);
      return {
        id: entry.id,
        source: entry.source,
        label: formatGeoSource(entry.source),
        vendor: sourceVendor(kind, entry.source),
        purpose: kind === "crawler" ? (categories.get(entry.id) ?? "") : "",
        share: ratio(entry.recent, recentTotal) ?? 0,
        // Last week's figures need the same site floor as this week's.
        previousShare:
          entry.previous > 0 &&
          entry.previousSites.size >= PUBLIC_DATA_MIN_SITES
            ? ratio(entry.previous, previousTotal)
            : null,
        change:
          entry.matchedPrevious > 0 &&
          entry.matchedRecentSites.size >= PUBLIC_DATA_MIN_SITES &&
          entry.matchedPreviousSites.size >= PUBLIC_DATA_MIN_SITES
            ? round(entry.matchedRecent / entry.matchedPrevious - 1)
            : null,
        reach: ratio(entry.recentSites.size, activeSites) ?? 0,
        medianDailyVisits: round(
          median([...entry.recentSites.values()]) / PUBLIC_DATA_RECENT_DAYS,
          1
        ),
        // Markdown requests from fewer than five sites stay unpublished.
        markdownShare:
          kind === "crawler" &&
          md &&
          (md.markdown === 0 ||
            (markdownSites.get(entry.id)?.size ?? 0) >= PUBLIC_DATA_MIN_SITES)
            ? ratio(md.markdown, md.visits)
            : null,
        dailyPerSite: round(
          entry.recent / activeSites / PUBLIC_DATA_RECENT_DAYS,
          2
        ),
      };
    });
}

function purposeShares(
  totals: PublicAiTrafficSourceTotals[],
  categories: Map<string, string>
): PublicAiTrafficPurpose[] {
  const crawlers = totals.filter((entry) => entry.kind === "crawler");
  const recentTotal = kindTotal(crawlers, "crawler", (entry) => entry.recent);
  const previousTotal = kindTotal(
    crawlers,
    "crawler",
    (entry) => entry.previous
  );
  return PURPOSES.flatMap((purpose) => {
    const members = crawlers.filter(
      (entry) => categories.get(entry.id) === purpose
    );
    const recentSites = new Set(
      members.flatMap((entry) => [...entry.recentSites.keys()])
    );
    // A purpose fed by too few sites would expose those sites' traffic.
    if (recentSites.size < PUBLIC_DATA_MIN_SITES) {
      return [];
    }
    const previousSites = new Set(
      members.flatMap((entry) => [...entry.previousSites])
    );
    const recent = members.reduce((sum, entry) => sum + entry.recent, 0);
    const previous = members.reduce((sum, entry) => sum + entry.previous, 0);
    return [
      {
        purpose,
        share: ratio(recent, recentTotal) ?? 0,
        previousShare:
          previousSites.size >= PUBLIC_DATA_MIN_SITES
            ? ratio(previous, previousTotal)
            : null,
      },
    ];
  });
}

function vendorRatios(
  totals: PublicAiTrafficSourceTotals[]
): PublicAiTrafficVendor[] {
  const vendors = new Map<
    string,
    {
      crawls: number;
      referrals: number;
      crawlSites: Set<string>;
      referralSites: Set<string>;
    }
  >();
  let allCrawls = 0;
  for (const entry of totals) {
    if (entry.kind === "crawler") {
      allCrawls += entry.ratioVisits;
    }
    const vendor = sourceVendor(entry.kind, entry.source);
    if (!vendor) {
      continue;
    }
    const totalsForVendor = vendors.get(vendor) ?? {
      crawls: 0,
      referrals: 0,
      crawlSites: new Set<string>(),
      referralSites: new Set<string>(),
    };
    const sites =
      entry.kind === "crawler"
        ? totalsForVendor.crawlSites
        : totalsForVendor.referralSites;
    for (const site of entry.ratioSites) {
      sites.add(site);
    }
    if (entry.kind === "crawler") {
      totalsForVendor.crawls += entry.ratioVisits;
    } else {
      totalsForVendor.referrals += entry.ratioVisits;
    }
    vendors.set(vendor, totalsForVendor);
  }
  return [...vendors.entries()]
    .filter(
      ([, entry]) =>
        entry.crawls > 0 &&
        entry.referrals > 0 &&
        entry.crawlSites.size >= PUBLIC_DATA_MIN_SITES &&
        entry.referralSites.size >= PUBLIC_DATA_MIN_SITES
    )
    .map(([vendor, entry]) => ({
      vendor,
      crawlShare: ratio(entry.crawls, allCrawls) ?? 0,
      crawlsPerReferral: round(entry.crawls / entry.referrals, 1),
    }))
    .toSorted((a, b) => b.crawlShare - a.crawlShare);
}

/**
 * Daily visits of one kind per measured site, per group: the bars of the
 * page's charts. Dividing by the day's sites keeps volume and growth visible
 * without publishing visit or site counts. A value stays null unless both the
 * day and that group had traffic on enough sites. A group's sites are the
 * largest per-source count inside it, a lower bound on its distinct sites,
 * so combined buckets like "Other" never pass on one customer's traffic.
 */
function dailyVolume({
  daily,
  days,
  kind,
  groupOf,
  series,
}: {
  daily: PublicAiTrafficDailyRow[];
  days: string[];
  kind: PublicAiTrafficKind;
  groupOf: (row: PublicAiTrafficDailyRow) => string | null;
  series: { key: string; label: string }[];
}): PublicAiTrafficChart {
  const sitesByDay = new Map<string, number>();
  const byDay = new Map<string, Map<string, number>>();
  const groupSitesByDay = new Map<string, Map<string, number>>();
  for (const row of daily) {
    if (row.visitor_type === "") {
      sitesByDay.set(row.day, row.projects);
      continue;
    }
    if (row.visitor_type !== kind) {
      continue;
    }
    const group = groupOf(row);
    if (!group) {
      continue;
    }
    const groups = byDay.get(row.day) ?? new Map<string, number>();
    groups.set(group, (groups.get(group) ?? 0) + row.visits);
    byDay.set(row.day, groups);
    const groupSites =
      groupSitesByDay.get(row.day) ?? new Map<string, number>();
    groupSites.set(group, Math.max(groupSites.get(group) ?? 0, row.projects));
    groupSitesByDay.set(row.day, groupSites);
  }
  const chartDays = days.map((day) => {
    const sites = sitesByDay.get(day) ?? 0;
    const groups = byDay.get(day);
    const groupSites = groupSitesByDay.get(day);
    const publishable = sites >= PUBLIC_DATA_MIN_SITES && groups !== undefined;
    return {
      day,
      values: Object.fromEntries(
        series.map(({ key }) => {
          if (!publishable) {
            return [key, null];
          }
          const visits = groups.get(key) ?? 0;
          if (visits === 0) {
            return [key, 0];
          }
          return [
            key,
            (groupSites?.get(key) ?? 0) >= PUBLIC_DATA_MIN_SITES
              ? round(visits / sites, 2)
              : null,
          ];
        })
      ),
    };
  });
  // "Other" withheld on some days would make the total jump with it, so it is
  // published on every day or not at all.
  const otherWithheld = chartDays.some(
    (entry) =>
      Object.hasOwn(entry.values, PUBLIC_DATA_OTHER_KEY) &&
      entry.values[PUBLIC_DATA_OTHER_KEY] === null &&
      Object.values(entry.values).some((value) => value !== null)
  );
  if (!otherWithheld) {
    return { series, days: chartDays };
  }
  return {
    series: series.filter(({ key }) => key !== PUBLIC_DATA_OTHER_KEY),
    days: chartDays.map((entry) => ({
      day: entry.day,
      values: Object.fromEntries(
        Object.entries(entry.values).filter(
          ([key]) => key !== PUBLIC_DATA_OTHER_KEY
        )
      ),
    })),
  };
}

function chartSeries<T>(
  rows: T[],
  limit: number,
  idOf: (row: T) => string,
  labelOf: (row: T) => string,
  weight: (row: T) => number
) {
  const charted = rows
    .toSorted((a, b) => weight(b) - weight(a))
    .slice(0, limit);
  const keys = new Map(
    charted.map((row, index) => [idOf(row), `s${index + 1}`])
  );
  return {
    keyOf: (id: string) => keys.get(id) ?? PUBLIC_DATA_OTHER_KEY,
    series: [
      ...charted.map((row) => ({
        key: keys.get(idOf(row)) ?? idOf(row),
        label: labelOf(row),
      })),
      { key: PUBLIC_DATA_OTHER_KEY, label: "Other" },
    ],
  };
}

/**
 * Builds the public, anonymized AI traffic snapshot from cross-customer
 * Tinybird rows (sample and demo projects already removed). Only shares,
 * reach and per-site medians leave this function; every listed bot,
 * assistant and company reached `PUBLIC_DATA_MIN_SITES` sites.
 */
export function buildPublicAiTrafficSnapshot(
  input: PublicAiTrafficInput
): PublicAiTrafficSnapshot {
  const { today, generatedAt } = input;
  // The pipes leave hidden sources out already; this keeps the snapshot
  // honest if a caller forgets the parameter.
  const daily = input.daily.filter((row) => !HIDDEN_SOURCES.has(row.source));
  const projects = input.projects.filter(
    (row) => !HIDDEN_SOURCES.has(row.source)
  );
  const window = publicAiTrafficWindow(today);
  const totals = [...sourceTotals(projects).values()];
  const activeSites = new Set(
    projects
      .filter((row) => row.weeks_ago === 0 && row.visits > 0)
      .map((row) => row.project_id)
  ).size;

  const base = {
    version: 1 as const,
    generatedAt,
    day: window.to,
    window: {
      from: window.from,
      to: window.to,
      recentFrom: window.recentFrom,
    },
    minSites: PUBLIC_DATA_MIN_SITES,
  };
  if (activeSites < PUBLIC_DATA_MIN_TOTAL_SITES) {
    return {
      ...base,
      available: false,
      summary: {
        crawlsPerReferral: null,
        markdownShare: null,
        trainingShare: null,
      },
      crawlers: [],
      referrers: [],
      purposes: [],
      vendors: [],
      crawlerVolume: { series: [], days: [] },
      referrerVolume: { series: [], days: [] },
      purposeVolume: { series: [], days: [] },
      vendorVolume: { series: [], days: [] },
    };
  }

  const categories = new Map<string, string>();
  const markdown = new Map<string, { visits: number; markdown: number }>();
  const windowVisits = new Map<string, number>();
  let recentCrawls = 0;
  let recentMarkdown = 0;
  for (const row of daily) {
    const kind = toKind(row.visitor_type);
    if (!kind) {
      continue;
    }
    const id = sourceId(kind, row.source);
    if (row.category && !categories.has(id)) {
      categories.set(id, row.category);
    }
    windowVisits.set(id, (windowVisits.get(id) ?? 0) + row.visits);
    if (kind === "crawler" && row.day >= window.recentFrom) {
      const entry = markdown.get(id) ?? { visits: 0, markdown: 0 };
      entry.visits += row.visits;
      entry.markdown += row.markdown_visits;
      markdown.set(id, entry);
      recentCrawls += row.visits;
      recentMarkdown += row.markdown_visits;
    }
  }

  const markdownSites = recentMarkdownSites(projects);
  const allMarkdownSites = new Set(
    [...markdownSites.values()].flatMap((sites) => [...sites])
  ).size;
  const days = dayRange(window.from, window.to);
  const crawlers = leaderboard({
    totals,
    kind: "crawler",
    limit: PUBLIC_DATA_TOP_CRAWLERS,
    activeSites,
    categories,
    markdown,
    markdownSites,
  });
  const referrers = leaderboard({
    totals,
    kind: "ai_referral",
    limit: PUBLIC_DATA_TOP_REFERRERS,
    activeSites,
    categories,
    markdown,
    markdownSites,
  });
  const purposes = purposeShares(totals, categories);

  const ratioCrawls = kindTotal(totals, "crawler", (e) => e.ratioVisits);
  const ratioReferrals = kindTotal(totals, "ai_referral", (e) => e.ratioVisits);

  // Charted bots, assistants and companies all clear the anonymity floor:
  // they come from the leaderboards, ranked over the whole chart window.
  const byWindow = (row: { id: string }) => windowVisits.get(row.id) ?? 0;
  const bots = chartSeries(
    crawlers,
    PUBLIC_DATA_CHART_CRAWLERS,
    (row) => row.id,
    (row) => row.label,
    byWindow
  );
  const assistants = chartSeries(
    referrers,
    PUBLIC_DATA_CHART_REFERRERS,
    (row) => row.id,
    (row) => row.label,
    byWindow
  );
  const vendorWindow = new Map<string, number>();
  for (const row of crawlers) {
    if (row.vendor) {
      vendorWindow.set(
        row.vendor,
        (vendorWindow.get(row.vendor) ?? 0) + byWindow(row)
      );
    }
  }
  const companies = chartSeries(
    [...vendorWindow.keys()],
    PUBLIC_DATA_CHART_VENDORS,
    (vendor) => vendor,
    (vendor) => vendor,
    (vendor) => vendorWindow.get(vendor) ?? 0
  );

  return {
    ...base,
    available: true,
    summary: {
      // Each summary figure needs five sites behind each of its parts.
      crawlsPerReferral:
        ratioReferrals > 0 &&
        kindSites(totals, "crawler") >= PUBLIC_DATA_MIN_SITES &&
        kindSites(totals, "ai_referral") >= PUBLIC_DATA_MIN_SITES
          ? round(ratioCrawls / ratioReferrals, 1)
          : null,
      markdownShare:
        recentMarkdown === 0 || allMarkdownSites >= PUBLIC_DATA_MIN_SITES
          ? ratio(recentMarkdown, recentCrawls)
          : null,
      trainingShare:
        purposes.find((entry) => entry.purpose === PUBLIC_DATA_TRAINING_PURPOSE)
          ?.share ?? null,
    },
    crawlers,
    referrers,
    purposes,
    vendors: vendorRatios(totals),
    crawlerVolume: dailyVolume({
      daily,
      days,
      kind: "crawler",
      groupOf: (row) => bots.keyOf(sourceId("crawler", row.source)),
      series: bots.series,
    }),
    referrerVolume: dailyVolume({
      daily,
      days,
      kind: "ai_referral",
      groupOf: (row) => assistants.keyOf(sourceId("ai_referral", row.source)),
      series: assistants.series,
    }),
    purposeVolume: dailyVolume({
      daily,
      days,
      kind: "crawler",
      groupOf: (row) => (PURPOSES.includes(row.category) ? row.category : null),
      series: PUBLIC_DATA_PURPOSES.map(({ purpose, label }) => ({
        key: purpose,
        label,
      })),
    }),
    vendorVolume: dailyVolume({
      daily,
      days,
      kind: "crawler",
      groupOf: (row) =>
        companies.keyOf(geoAgentVendor(row.source) ?? PUBLIC_DATA_OTHER_KEY),
      series: companies.series,
    }),
  };
}
