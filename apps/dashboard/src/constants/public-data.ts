/** Days the public AI traffic charts cover, ending with yesterday (UTC). */
export const PUBLIC_DATA_WINDOW_DAYS = 60;
/** Leaderboards compare the last 7 full days with the 7 before. */
export const PUBLIC_DATA_RECENT_DAYS = 7;
/** Crawl-to-referral ratios need a longer window; referrals are sparse. */
export const PUBLIC_DATA_RATIO_WEEKS = 4;
/**
 * Assistants rank over four weeks against the four before: referrals are too
 * sparse for one assistant to reach the site floor in a single week.
 */
export const PUBLIC_DATA_REFERRER_WEEKS = 4;
/**
 * Each chart day averages the week ending on it, so a day clears the site
 * floor when enough sites were measured that week, not on that one day.
 */
export const PUBLIC_DATA_ROLLING_DAYS = 7;
/** Hours, countries and llms.txt cover the last 28 full days. */
export const PUBLIC_DATA_DETAIL_DAYS = 28;
export const PUBLIC_DATA_TOP_COUNTRIES = 20;

/**
 * Anonymity floor: a bot, assistant, company, country or chart day is only
 * published when at least this many distinct sites stand behind it, so no
 * number describes a single customer.
 */
export const PUBLIC_DATA_MIN_SITES = 3;
/**
 * Trends pipes key traffic sent without a project (an organization-wide
 * token) as `org:<organization id>`, one site per organization.
 */
export const TRAFFIC_ORG_SITE_PREFIX = "org:";
/**
 * Days most AI traffic events were lost at ingest: a retired signing secret
 * rejected older tracking tokens. The chart's rolling windows leave them out.
 */
export const PUBLIC_DATA_INGEST_GAP = { from: "2026-10-31", to: "2026-11-04" };
/** Below this many measured sites nothing is published at all. */
export const PUBLIC_DATA_MIN_TOTAL_SITES = 10;
/**
 * A site counts with at most this many times the median site's visits for a
 * bot or assistant, and never more than all other sites together, so one large
 * site neither sets nor dominates a published share. The daily pipe applies
 * it per day (`site_cap_factor`), the builder per week. The chart leaves it
 * off: with few, uneven sites the median swings, and the cap would follow it
 * instead of the traffic.
 */
export const PUBLIC_DATA_SITE_CAP_FACTOR = 5;

export const PUBLIC_DATA_TOP_CRAWLERS = 20;
export const PUBLIC_DATA_TOP_REFERRERS = 12;
/** Series charted on their own; the rest fold into "Other". */
export const PUBLIC_DATA_CHART_CRAWLERS = 8;
export const PUBLIC_DATA_CHART_REFERRERS = 6;
export const PUBLIC_DATA_CHART_VENDORS = 8;
export const PUBLIC_DATA_OTHER_KEY = "other";
/**
 * A chart day's value for every bot or assistant of the kind together, checked
 * on its own, so a group withheld by the floor doesn't blank the day's total.
 */
export const PUBLIC_DATA_TOTAL_KEY = "total";

/** Shares are rounded so the snapshot stays small and carries no exact ratios of raw counts. */
export const PUBLIC_DATA_SHARE_DECIMALS = 4;

export const PUBLIC_DATA_CACHE_KEY_PREFIX = "public-data:ai-traffic:v1";
/** Snapshots are keyed by day. Each key expires two days after it is written. */
export const PUBLIC_DATA_CACHE_TTL_SECONDS = 2 * 24 * 60 * 60;

/** How long an instance serves its in-memory snapshot before re-reading Redis. */
export const PUBLIC_DATA_MEMORY_TTL_MS = 5 * 60 * 1000;

/** CDN caching for the public endpoint; a snapshot only changes once a day. */
export const PUBLIC_DATA_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";

/**
 * The company behind each AI assistant that refers visitors, keyed by the
 * referral `source` the ingest records. Crawler vendors come from the bot
 * signatures instead.
 */
export const PUBLIC_DATA_REFERRER_VENDORS: Record<string, string> = {
  chatgpt: "OpenAI",
  openai: "OpenAI",
  perplexity: "Perplexity",
  gemini: "Google",
  google: "Google",
  claude: "Anthropic",
  anthropic: "Anthropic",
  copilot: "Microsoft",
  microsoft: "Microsoft",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  grok: "xAI",
  xai: "xAI",
  meta: "Meta",
  you: "You.com",
  "you.com": "You.com",
  kimi: "Moonshot AI",
  moonshot: "Moonshot AI",
  qwen: "Alibaba",
  alibaba: "Alibaba",
  duckduckgo: "DuckDuckGo",
  kagi: "Kagi",
};

/** Crawl purposes in the order the page lists them, with public labels. */
export const PUBLIC_DATA_PURPOSES = [
  { purpose: "training-crawler", label: "Model training" },
  { purpose: "search-index", label: "Search indexing" },
  { purpose: "assistant-browse", label: "Live answers" },
] as const;
export const PUBLIC_DATA_TRAINING_PURPOSE = "training-crawler";
