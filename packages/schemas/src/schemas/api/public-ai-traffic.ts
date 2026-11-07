import { z } from "zod";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shareSchema = z.number().min(0).max(1);

/**
 * One AI crawler or AI assistant referrer in the public data snapshot. Only
 * shares, reach and per-site medians are published, never visit or site
 * counts, so the snapshot can't be traced back to one customer or reveal
 * how many sites Notra measures.
 */
export const publicAiTrafficSourceSchema = z.object({
  /** `crawler:GPTBot` or `ai_referral:chatgpt`. */
  id: z.string(),
  source: z.string(),
  label: z.string(),
  vendor: z.string().nullable(),
  /** Crawl purpose (`training-crawler`, `search-index`, `assistant-browse`); empty for referrers. */
  purpose: z.string(),
  /** Share of this kind's visits in the last 7 days (crawlers) or 28 days (assistants). */
  share: shareSchema,
  /** Share in the period before, null when the source had no visits then. */
  previousShare: shareSchema.nullable(),
  /** Visit change against the 7 days before, over sites measured in both weeks. Null when new. */
  change: z.number().nullable(),
  /** Share of measured sites this source visited in the last 7 days. */
  reach: shareSchema,
  /** Daily visits on the typical site it visited in the last 7 days. */
  medianDailyVisits: z.number().nonnegative(),
  /** Share of its requests that asked for Markdown; null for referrers. */
  markdownShare: shareSchema.nullable(),
  /** Average daily visits per measured site in the last 7 days. */
  dailyPerSite: z.number().nonnegative(),
  /** Share of the sites it visited where it fetched /llms.txt, last 28 days; null for referrers. */
  llmsTxtReach: shareSchema.nullable().optional(),
  /** Pages per AI-referred visit, last 28 days; null for crawlers. */
  pagesPerVisit: z.number().nonnegative().nullable().optional(),
  /** Share of AI-referred visits that went on to a second page; null for crawlers. */
  multiPageShare: shareSchema.nullable().optional(),
});

export const publicAiTrafficPurposeSchema = z.object({
  purpose: z.string(),
  share: shareSchema,
  previousShare: shareSchema.nullable(),
});

export const publicAiTrafficVendorSchema = z.object({
  vendor: z.string(),
  /** Share of all AI crawler visits from this company's bots, last 28 days. */
  crawlShare: shareSchema,
  /** Crawler visits for every visit its assistant referred, last 28 days. */
  crawlsPerReferral: z.number().nonnegative(),
});

/** Where AI assistant referrals come from, by visitor country, last 28 days. */
export const publicAiTrafficCountrySchema = z.object({
  /** ISO 3166-1 alpha-2. */
  country: z.string().length(2),
  share: shareSchema,
  /** Change of its share against the 28 days before (0.2 = a fifth more); null when new. */
  change: z.number().nullable(),
});

/** Share of a kind's visits per UTC weekday (Mon first) and hour, last 28 days. */
export const publicAiTrafficHoursSchema = z.array(z.array(shareSchema));

export const publicAiTrafficSeriesSchema = z.object({
  key: z.string(),
  label: z.string(),
});

/** One day's visits per measured site, per series key; null where too few sites had traffic to publish. */
export const publicAiTrafficDaySchema = z.object({
  day: daySchema,
  values: z.record(z.string(), z.number().nonnegative().nullable()),
});

export const publicAiTrafficChartSchema = z.object({
  series: z.array(publicAiTrafficSeriesSchema),
  days: z.array(publicAiTrafficDaySchema),
});

export const publicAiTrafficSnapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  /** Last full UTC day the snapshot covers. */
  day: daySchema,
  /** False when too few sites had AI traffic to publish anything. */
  available: z.boolean(),
  window: z.object({
    from: daySchema,
    to: daySchema,
    recentFrom: daySchema,
    /** Days each chart point averages, ending on its day; absent means one. */
    averageDays: z.number().int().positive().optional(),
  }),
  /** A source needs traffic on at least this many sites to be listed. */
  minSites: z.number().int().positive(),
  summary: z.object({
    crawlsPerReferral: z.number().nullable(),
    markdownShare: shareSchema.nullable(),
    trainingShare: shareSchema.nullable(),
  }),
  crawlers: z.array(publicAiTrafficSourceSchema),
  referrers: z.array(publicAiTrafficSourceSchema),
  purposes: z.array(publicAiTrafficPurposeSchema),
  vendors: z.array(publicAiTrafficVendorSchema),
  /** Daily AI crawler visits per site, by bot. */
  crawlerVolume: publicAiTrafficChartSchema,
  /** Daily AI referral visits per site, by assistant. */
  referrerVolume: publicAiTrafficChartSchema,
  /** Daily AI crawler visits per site, by crawl purpose. */
  purposeVolume: publicAiTrafficChartSchema,
  /** Daily AI crawler visits per site, by company. */
  vendorVolume: publicAiTrafficChartSchema,
  countries: z.array(publicAiTrafficCountrySchema).optional(),
  /** Each kind's grid is null when too few sites had that kind of traffic. */
  hours: z
    .object({
      crawlers: publicAiTrafficHoursSchema.nullable(),
      referrals: publicAiTrafficHoursSchema.nullable(),
    })
    .optional(),
});
