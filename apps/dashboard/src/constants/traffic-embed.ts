import type {
  TrafficEmbedChart,
  TrafficEmbedRange,
  TrafficEmbedDataSource,
} from "../types/traffic-embed";

/** About 143 bits from nanoid's 64-symbol alphabet, like chat share links. */
export const TRAFFIC_EMBED_ID_LENGTH = 24;

export const TRAFFIC_EMBED_PATH_PREFIX = "/embed/ai-traffic/";

/** The JSON the embed page polls for fresh numbers. */
export const TRAFFIC_EMBED_DATA_PATH_PREFIX = "/api/public/embeds/ai-traffic/";

/**
 * The CDN answers polls for this long, so a wall of displays showing one
 * embed costs one origin request per window.
 */
export const TRAFFIC_EMBED_DATA_CDN_TTL_SECONDS = 15;

/** How often an open embed checks for new numbers. */
export const TRAFFIC_EMBED_POLL_INTERVAL_MS = 30_000;

/** Failed polls back off up to this; the last numbers stay on screen. */
export const TRAFFIC_EMBED_POLL_MAX_BACKOFF_MS = 300_000;

/**
 * A new deploy or a changed chart list or domain list reloads the page so
 * its code and frame-ancestors match. Never more often than this, so a
 * flapping value can't put a display into a reload loop.
 */
export const TRAFFIC_EMBED_RELOAD_MIN_INTERVAL_MS = 600_000;

export const TRAFFIC_EMBED_RELOAD_STORAGE_KEY = "notra-embed-reloaded-at";

export const TRAFFIC_EMBED_RANGES = [
  "7d",
  "14d",
  "30d",
  "90d",
] as const satisfies readonly TrafficEmbedRange[];

export const TRAFFIC_EMBED_DEFAULT_RANGE: TrafficEmbedRange = "30d";

export const TRAFFIC_EMBED_MAX_PER_ORGANIZATION = 50;

/**
 * Embeds sit on customer pages and wall displays, so every view would
 * otherwise be a query. A cached source counts as fresh this long; after
 * that the next request still gets it at once while one refresh runs in the
 * background. Sources built from scan checks also refresh as soon as the
 * organization's check generation moves, so a finished scan shows on the
 * next poll.
 */
export const TRAFFIC_EMBED_DATA_FRESH_SECONDS = 60;

/**
 * How long a cached source can be served stale while it refreshes. Keys
 * also carry the window's last day, so a new day starts a new entry.
 */
export const TRAFFIC_EMBED_DATA_TTL_SECONDS = 86_400;

/** One instance refreshes a stale source at a time; this bounds a lost lock. */
export const TRAFFIC_EMBED_REFRESH_LOCK_SECONDS = 30;

/**
 * How long a revoked or edited embed can keep its old config when dropping
 * the cached entry fails. A CDN miss at the end of that window caches the
 * page again, so this and the CDN TTL add up to the minute the delete dialog
 * promises.
 */
export const TRAFFIC_EMBED_CONFIG_TTL_SECONDS = 30;

/**
 * Vercel's CDN serves an embed page this long without running it. Nothing
 * purges it, so this is how long a deleted embed or removed domain still
 * shows.
 */
export const TRAFFIC_EMBED_CDN_TTL_SECONDS = 30;

/** v3 wraps each source with when it was loaded and the check generation. */
export const TRAFFIC_EMBED_CACHE_PREFIX = "cache:geo-traffic-embed:v3";

export const TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS = 300;

export const TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS = 1000;

export const TRAFFIC_EMBED_RESIZE_MESSAGE = "notra:embed:resize";

export const TRAFFIC_EMBED_DEFAULT_HEIGHT = 420;

/**
 * The dialog preview renders the embed at desktop width and shrinks it, so
 * it shows the real layout without taking the whole dialog. Keep in step
 * with `TRAFFIC_EMBED_PREVIEW_FRAME_CLASS`.
 */
export const TRAFFIC_EMBED_PREVIEW_SCALE = 0.6;

export const TRAFFIC_EMBED_PREVIEW_FRAME_CLASS =
  "block w-[calc(100%/0.6)] origin-top-left scale-[0.6]";

/** Shows a preview that loaded without reporting its height, e.g. an error. */
export const TRAFFIC_EMBED_PREVIEW_REVEAL_FALLBACK_MS = 800;

/**
 * The page needs its own origin to hydrate; popups let the attribution link
 * open and downloads let the chart's PNG export save. Top navigation stays
 * blocked, so the frame can't redirect its host.
 */
export const TRAFFIC_EMBED_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads";

/** Cached in place of a config for ids with no active embed. */
export const TRAFFIC_EMBED_CONFIG_MISS = "missing";

/** Never written, so embeds don't share the dashboard's saved theme. */
export const TRAFFIC_EMBED_THEME_STORAGE_KEY = "notra-embed-theme";

/** Sources computed from scan checks; they follow the check generation. */
export const TRAFFIC_EMBED_CHECK_SOURCES: ReadonlySet<TrafficEmbedDataSource> =
  new Set(["timeseries", "overview", "shareOfVoice", "languages"]);

/** What each chart reads; engines reuse the visibility series for trends. */
export const TRAFFIC_EMBED_CHART_SOURCES: Record<
  TrafficEmbedChart,
  readonly TrafficEmbedDataSource[]
> = {
  traffic: ["traffic"],
  visibility: ["timeseries"],
  engines: ["overview", "timeseries"],
  "share-of-voice": ["shareOfVoice"],
  languages: ["languages"],
  countries: ["countries"],
};
