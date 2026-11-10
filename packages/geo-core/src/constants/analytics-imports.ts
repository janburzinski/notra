import type { AnalyticsImportProvider } from "@notra/db/types/analytics-imports";

import type {
  CloudflareRumQuery,
  ImportProviderInfo,
  ImportReferrerName,
  PlausibleCsvTable,
} from "../types/analytics-imports";

export const IMPORT_BATCH_ROWS = 10_000;
/**
 * Records one CSV import step writes at most: a step parses the whole export
 * (about a million records a second) and writes only its days, so every
 * step stays far inside a function's time limit.
 */
export const IMPORT_CSV_RECORDS_PER_CHUNK = 250_000;
export const IMPORT_COMPLETED_IDS_CACHE_MS = 30_000;
export const IMPORT_COMPLETED_IDS_CACHE_MAX_ENTRIES = 1000;
export const IMPORT_DEFAULT_RETRY_AFTER_SECONDS = 60;
export const IMPORT_MAX_RETRY_AFTER_SECONDS = 3600;
export const IMPORT_REQUEST_TIMEOUT_MS = 30_000;
export const IMPORT_MAX_PATH_LENGTH = 1024;
export const IMPORT_CSV_MAX_ZIP_BYTES = 200 * 1024 * 1024;
/** All CSV files of one export together, and any one of them. */
export const IMPORT_CSV_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
/**
 * The ZIP is fed to the inflater in slices this size, so one push can never
 * expand to more than about 64 MB (DEFLATE tops out near 1:1032).
 */
export const IMPORT_CSV_ZIP_SLICE_BYTES = 64 * 1024;
/** Plausible exports hold about a dozen files. */
export const IMPORT_CSV_MAX_ENTRIES = 32;
/** CSV compresses roughly 5-20x; far more is a ZIP bomb. */
export const IMPORT_CSV_MAX_COMPRESSION_RATIO = 200;
/** Below this, a high ratio is just a small, repetitive file. */
export const IMPORT_CSV_RATIO_MIN_BYTES = 1024 * 1024;
export const IMPORT_CSV_MAX_FIELD_LENGTH = 4 * 1024;
export const IMPORT_CSV_MAX_ROW_CELLS = 64;
export const IMPORT_CSV_MAX_ROW_LENGTH = 16 * 1024;
export const IMPORT_RATE_LIMIT_KEY_PREFIX = "import:rl";

/** Per-connection request budgets, kept below each provider's published limit. */
export const IMPORT_RATE_LIMITS = {
  plausible: { requests: 400, windowSeconds: 3600 },
  cloudflare: { requests: 250, windowSeconds: 300 },
  vercel: { requests: 60, windowSeconds: 60 },
  /**
   * Rybbit refills a 50-request bucket at 5 a second, so 25 per 10 s never
   * empties it, even across a window edge. The daily cap leaves a fifth of
   * the Standard plan's 5,000 requests for the customer's own API use.
   */
  rybbit: { requests: 25, windowSeconds: 10, dailyRequests: 4000 },
  /** Databuddy allows 120 queries a minute per key; half stays with the customer. */
  databuddy: { requests: 60, windowSeconds: 60 },
} as const;

/**
 * A Vercel chunk makes 1 + 7 requests per day; 7 days (50 requests) fit one
 * window of its budget, so a chunk retried after a limit always completes.
 */
export const VERCEL_CHUNK_DAYS = 7;

/**
 * A Cloudflare Web Analytics chunk makes one request per query and query
 * window (one day on plans whose longest query is a day) plus one for the
 * plan's limits: 7 days take 50 of the 250-request window, leaving room to
 * split busy days, so a chunk retried after a limit completes.
 */
export const CLOUDFLARE_RUM_CHUNK_DAYS = 7;

/**
 * A Rybbit chunk makes one time-series request plus one per breakdown and
 * day: 3 days take 25 requests, one window of its budget.
 */
export const RYBBIT_CHUNK_DAYS = 3;

/**
 * A Databuddy chunk is one request: daily totals plus one query per
 * breakdown and day, batched. A week keeps that batch small enough for a
 * busy site's analytics database to answer within the request timeout.
 */
export const DATABUDDY_CHUNK_DAYS = 7;

export const IMPORT_PROVIDERS: Record<
  AnalyticsImportProvider,
  ImportProviderInfo
> = {
  plausible_csv: {
    connection: null,
    kind: "web",
    lookbackDays: null,
    writesSubdomains: true,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: true,
      entryPages: true,
      sampled: false,
    },
  },
  plausible: {
    connection: "plausible",
    kind: "web",
    lookbackDays: null,
    writesSubdomains: true,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: true,
      entryPages: true,
      sampled: false,
    },
  },
  vercel: {
    connection: "vercel",
    kind: "web",
    lookbackDays: 730,
    writesSubdomains: false,
    maxChunkDays: VERCEL_CHUNK_DAYS,
    capabilities: {
      visitors: true,
      visits: false,
      bounces: false,
      utm: true,
      entryPages: false,
      sampled: false,
    },
  },
  cloudflare: {
    connection: "cloudflare",
    kind: "geo",
    lookbackDays: null,
    writesSubdomains: true,
    capabilities: {
      visitors: false,
      visits: true,
      bounces: false,
      utm: false,
      entryPages: false,
      sampled: true,
    },
  },
  cloudflare_rum: {
    connection: "cloudflare",
    kind: "web",
    lookbackDays: null,
    writesSubdomains: true,
    maxChunkDays: CLOUDFLARE_RUM_CHUNK_DAYS,
    capabilities: {
      visitors: false,
      visits: true,
      bounces: false,
      utm: false,
      entryPages: true,
      sampled: true,
    },
  },
  rybbit: {
    connection: "rybbit",
    kind: "web",
    lookbackDays: null,
    writesSubdomains: false,
    maxChunkDays: RYBBIT_CHUNK_DAYS,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: true,
      entryPages: true,
      sampled: false,
    },
  },
  databuddy: {
    connection: "databuddy",
    kind: "web",
    lookbackDays: null,
    writesSubdomains: false,
    maxChunkDays: DATABUDDY_CHUNK_DAYS,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: true,
      entryPages: true,
      sampled: false,
    },
  },
};

export const PLAUSIBLE_API_URL = "https://plausible.io";
export const PLAUSIBLE_PAGE_LIMIT = 10_000;
export const PLAUSIBLE_SITES_PAGE_LIMIT = 100;
export const PLAUSIBLE_SITES_MAX_PAGES = 20;

export const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4";
export const CLOUDFLARE_PAGE_LIMIT = 10_000;
export const CLOUDFLARE_USER_AGENT_FILTER_SIZE = 35;
export const CLOUDFLARE_MIN_SPLIT_MS = 60 * 60 * 1000;
export const CLOUDFLARE_DAY_SPLIT_MS = 24 * CLOUDFLARE_MIN_SPLIT_MS;
export const CLOUDFLARE_RATE_LIMIT_RETRY_SECONDS = 300;
/**
 * Cloudflare answers a malformed or unknown token with 400 and one of these
 * error codes (invalid request headers, invalid Authorization header, invalid
 * access token, authentication error) instead of 401 or 403.
 */
export const CLOUDFLARE_AUTH_ERROR_CODE_PATTERN =
  /"code":\s*(?:6003|6111|9106|9109|10000)\b/;
/** Waits for a 429 without timing headers, per provider. */
export const IMPORT_RETRY_AFTER_FALLBACK_SECONDS: Readonly<
  Record<string, number>
> = { cloudflare: CLOUDFLARE_RATE_LIMIT_RETRY_SECONDS };
export const CLOUDFLARE_LIST_PAGE_SIZE = 50;
export const CLOUDFLARE_CRAWLER_DATASET = "httpRequestsAdaptiveGroups";
export const CLOUDFLARE_RUM_DATASET = "rumPageloadEventsAdaptiveGroups";
/** Days start this much after a dataset's retention edge, so a slow request still fits. */
export const CLOUDFLARE_RETENTION_MARGIN_MS = 15 * 60 * 1000;
export const CLOUDFLARE_LIST_MAX_PAGES = 20;
/** Joins a Web Analytics site's account and site tag into one source ref. */
export const CLOUDFLARE_RUM_REF_SEPARATOR = "/";

/** Each RUM query groups by date plus these dimensions and feeds these grains. */
export const CLOUDFLARE_RUM_QUERIES: readonly CloudflareRumQuery[] = [
  { dimensions: { requestHost: "host" }, grains: ["total"] },
  {
    dimensions: { requestHost: "host", requestPath: "path" },
    grains: ["page", "entry_page"],
  },
  {
    dimensions: { requestHost: "host", refererHost: "referrer" },
    grains: ["source"],
  },
  { dimensions: { countryName: "country" }, grains: ["country"] },
  { dimensions: { deviceType: "device" }, grains: ["device"] },
  { dimensions: { userAgentBrowser: "browser" }, grains: ["browser"] },
  { dimensions: { userAgentOS: "os" }, grains: ["os"] },
];

export const VERCEL_API_URL = "https://api.vercel.com";
export const VERCEL_RESULT_LIMIT = 100;
export const VERCEL_OTHERS_GROUP = "Others";
export const VERCEL_CONCURRENCY = 4;
export const VERCEL_PROJECTS_PAGE_LIMIT = 100;
export const VERCEL_PROJECTS_MAX_PAGES = 10;

export const DATABUDDY_API_URL = "https://api.databuddy.cc";
/** Top values per breakdown and day, as for Rybbit. */
export const DATABUDDY_RESULT_LIMIT = 200;
/** Days a preview can return: everything since 2015, one row per day. */
export const DATABUDDY_PREVIEW_LIMIT = 10_000;
export const DATABUDDY_HISTORY_START = "2015-01-01";
export const RYBBIT_API_URL = "https://app.rybbit.io";
/** Rows per breakdown and day; smaller values are dropped. */
export const RYBBIT_RESULT_LIMIT = 200;
export const RYBBIT_CONCURRENCY = 4;
/**
 * Where a preview starts looking. Rybbit imports Plausible and Umami
 * history, so a site's data can predate Rybbit itself.
 */
export const RYBBIT_HISTORY_START = "2015-01-01";

/** Request paths that only vulnerability scanners ask for. */
export const IMPORT_SCANNER_PATH_PATTERN =
  /(?:^|\/)(?:\.env|\.git|\.aws|\.ssh|\.DS_Store|wp-admin|wp-login\.php|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|cgi-bin|vendor\/phpunit|actuator|server-status|\.vscode|config\.json|firebaseConfig\.js|terraform\.tfvars|\.htaccess|\.htpasswd)(?:$|[/.?])|\.(?:php|asp|aspx|jsp|cgi|sql|bak|old|swp|ini|tfvars|pem|key)$/i;

const PLAUSIBLE_CSV_SESSION_COUNTS = [
  ["visitors", "visitors"],
  ["pageviews", "pageviews"],
  ["visits", "visits"],
  ["bounces", "bounces"],
  ["visit_duration", "visitDurationS"],
] as const;

/** Plausible's CSV export files: the exact headers each must carry and what we read. */
export const PLAUSIBLE_CSV_TABLES = {
  imported_visitors: {
    grain: "total",
    columns: [
      "date",
      "visitors",
      "pageviews",
      "bounces",
      "visits",
      "visit_duration",
    ],
    dimensions: {},
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
  imported_pages: {
    grain: "page",
    columns: ["date", "hostname", "page", "visits", "visitors", "pageviews"],
    dimensions: { hostname: "host", page: "path" },
    counts: [
      ["visitors", "visitors"],
      ["pageviews", "pageviews"],
      ["visits", "visits"],
    ],
  },
  imported_entry_pages: {
    grain: "entry_page",
    columns: [
      "date",
      "entry_page",
      "visitors",
      "entrances",
      "visit_duration",
      "bounces",
      "pageviews",
    ],
    dimensions: { entry_page: "path" },
    counts: [
      ["visitors", "visitors"],
      ["pageviews", "pageviews"],
      ["entrances", "visits"],
      ["entrances", "entrances"],
      ["bounces", "bounces"],
      ["visit_duration", "visitDurationS"],
    ],
  },
  imported_sources: {
    grain: "source",
    columns: [
      "date",
      "source",
      "referrer",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "pageviews",
      "visitors",
      "visits",
      "visit_duration",
      "bounces",
    ],
    dimensions: {
      source: "sourceName",
      referrer: "referrer",
      utm_source: "utmSource",
      utm_medium: "utmMedium",
      utm_campaign: "utmCampaign",
      utm_term: "utmTerm",
      utm_content: "utmContent",
    },
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
  imported_locations: {
    grain: "country",
    columns: [
      "date",
      "country",
      "region",
      "city",
      "visitors",
      "visits",
      "visit_duration",
      "bounces",
      "pageviews",
    ],
    dimensions: { country: "country" },
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
  imported_devices: {
    grain: "device",
    columns: [
      "date",
      "device",
      "visitors",
      "visits",
      "visit_duration",
      "bounces",
      "pageviews",
    ],
    dimensions: { device: "device" },
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
  imported_browsers: {
    grain: "browser",
    columns: [
      "date",
      "browser",
      "browser_version",
      "visitors",
      "visits",
      "visit_duration",
      "bounces",
      "pageviews",
    ],
    dimensions: { browser: "browser" },
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
  imported_operating_systems: {
    grain: "os",
    columns: [
      "date",
      "operating_system",
      "operating_system_version",
      "visitors",
      "visits",
      "visit_duration",
      "bounces",
      "pageviews",
    ],
    dimensions: { operating_system: "os" },
    counts: PLAUSIBLE_CSV_SESSION_COUNTS,
  },
} as const satisfies Record<string, PlausibleCsvTable>;

/** Files we accept in a Plausible export but do not import (custom events, exits). */
export const PLAUSIBLE_CSV_IGNORED_TABLES = [
  "imported_exit_pages",
  "imported_custom_events",
] as const;

export const PLAUSIBLE_CSV_FILE_PATTERN =
  /^(?:.*\/)?(imported_[a-z_]+?)_(\d{8})_(\d{8})\.csv$/;

/** Display names Plausible, GA4 and campaign tags use for referrers. */
export const IMPORT_REFERRER_NAMES: Record<string, ImportReferrerName> = {
  chatgpt: { group: "ai", source: "chatgpt" },
  "chatgpt.com": { group: "ai", source: "chatgpt" },
  openai: { group: "ai", source: "chatgpt" },
  claude: { group: "ai", source: "claude" },
  "claude.ai": { group: "ai", source: "claude" },
  perplexity: { group: "ai", source: "perplexity" },
  "perplexity.ai": { group: "ai", source: "perplexity" },
  gemini: { group: "ai", source: "gemini" },
  "google gemini": { group: "ai", source: "gemini" },
  copilot: { group: "ai", source: "copilot" },
  "microsoft copilot": { group: "ai", source: "copilot" },
  grok: { group: "ai", source: "grok" },
  deepseek: { group: "ai", source: "deepseek" },
  phind: { group: "ai", source: "phind" },
  mistral: { group: "ai", source: "mistral" },
  "le chat": { group: "ai", source: "mistral" },
  google: { group: "search", source: "google" },
  bing: { group: "search", source: "bing" },
  duckduckgo: { group: "search", source: "duckduckgo" },
  yahoo: { group: "search", source: "yahoo" },
  "yahoo!": { group: "search", source: "yahoo" },
  ecosia: { group: "search", source: "ecosia" },
  brave: { group: "search", source: "brave" },
  kagi: { group: "search", source: "kagi" },
  yandex: { group: "search", source: "yandex" },
  baidu: { group: "search", source: "baidu" },
  startpage: { group: "search", source: "startpage" },
  qwant: { group: "search", source: "qwant" },
  "x (twitter)": { group: "social", source: "x" },
  twitter: { group: "social", source: "x" },
  x: { group: "social", source: "x" },
  linkedin: { group: "social", source: "linkedin" },
  facebook: { group: "social", source: "facebook" },
  instagram: { group: "social", source: "instagram" },
  reddit: { group: "social", source: "reddit" },
  "hacker news": { group: "social", source: "hacker-news" },
  youtube: { group: "social", source: "youtube" },
  github: { group: "social", source: "github" },
  "product hunt": { group: "social", source: "product-hunt" },
  bluesky: { group: "social", source: "bluesky" },
  mastodon: { group: "social", source: "mastodon" },
  threads: { group: "social", source: "threads" },
  medium: { group: "social", source: "medium" },
  substack: { group: "social", source: "substack" },
};

export const IMPORT_DIRECT_NAMES = new Set([
  "",
  "direct",
  "direct / none",
  "(direct)",
  "(none)",
  "(not set)",
]);

export const IMPORT_UNKNOWN_VALUES = new Set([
  "",
  "(not set)",
  "unknown",
  "(unknown)",
  "n/a",
]);

export const IMPORT_DEVICE_NAMES: Record<string, string> = {
  desktop: "desktop",
  laptop: "desktop",
  "smart tv": "desktop",
  tv: "desktop",
  console: "desktop",
  mobile: "mobile",
  smartphone: "mobile",
  phone: "mobile",
  tablet: "tablet",
};

/** Ordered: the first fragment found in the lowercased name wins. */
export const IMPORT_BROWSER_FRAGMENTS: readonly [string, string][] = [
  ["edge", "Edge"],
  ["opera", "Opera"],
  ["samsung", "Samsung Internet"],
  ["firefox", "Firefox"],
  ["chrome", "Chrome"],
  ["chromium", "Chrome"],
  ["webview", "Chrome"],
  ["safari", "Safari"],
];

/** Ordered: iPadOS before iOS, ChromeOS before Linux. */
export const IMPORT_OS_FRAGMENTS: readonly [string, string][] = [
  ["ipados", "iPadOS"],
  ["ios", "iOS"],
  ["iphone", "iOS"],
  ["mac", "macOS"],
  ["os x", "macOS"],
  ["android", "Android"],
  ["windows", "Windows"],
  ["chrome os", "ChromeOS"],
  ["chromeos", "ChromeOS"],
  ["cros", "ChromeOS"],
  ["linux", "Linux"],
  ["ubuntu", "Linux"],
  ["fedora", "Linux"],
  ["debian", "Linux"],
  ["arch", "Linux"],
  ["mint", "Linux"],
];

export const IMPORT_NO_COUNTRY = new Set(["ZZ", "XX", "T1", "EU", "AP"]);
