import type {
  GeoIngestIdentityKind,
  GeoIngestIdentityPolicy,
} from "../types/ingest";

export const GEO_INGEST_FIRST_HIT_KEY_PREFIX = "geo:ingest-first-hit:v1";
export const GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES = 1024;
export const GEO_INGEST_RECEIVED_SAMPLE_RATE = 0.01;
export const GEO_INGEST_RECEIVED_SAMPLE_DENOMINATOR = 100;
export const GEO_INGEST_DROPPED_LOG_SAMPLE_RATE = 0.05;
export const GEO_INGEST_ERROR_MESSAGE_MAX_LENGTH = 200;
export const GEO_INGEST_RATELIMIT_TIMEOUT_MS = 1000;
export const GEO_INGEST_REDIS_RETRIES = 1;
export const GEO_INGEST_ADMISSION_RATELIMIT_PREFIX =
  "ratelimit:geo-ingest-admission";
export const GEO_INGEST_ADMISSION_RATELIMIT_MAX_REQUESTS = 1000;
export const WEB_INGEST_RATELIMIT_PREFIX = "ratelimit:web-ingest";
export const WEB_INGEST_RATELIMIT_MAX_REQUESTS = 20_000;
/**
 * Beacons per minute one network may send one project, checked before the
 * project budget. A page view costs about four beacons (view, hide, an
 * outbound click, a second hide), so 120 lets one address browse 30 pages a
 * minute while a copied key can take at most 0.6% of the project's 20,000.
 */
export const WEB_NETWORK_RATELIMIT_PREFIX = "ratelimit:web-network";
export const WEB_NETWORK_RATELIMIT_MAX_REQUESTS = 120;
/** Without a trusted client IP every visitor shares one, larger, bucket. */
export const WEB_SHARED_NETWORK_KEY = "shared";
export const WEB_SHARED_NETWORK_RATELIMIT_MAX_REQUESTS = 1000;
/** AI referrals from public keys: their own budget, never the server's. */
export const WEB_AI_RATELIMIT_PREFIX = "ratelimit:web-ai";
export const WEB_AI_RATELIMIT_MAX_REQUESTS = 120;
/** Browser AI referrals recorded (and billed) per project and UTC day. */
export const WEB_AI_DAILY_KEY_PREFIX = "geo:web-ai-daily:v1";
export const WEB_AI_DAILY_CAP = 5000;
export const WEB_DAILY_COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;
export const WEB_LOCAL_LIMITER_MAX_KEYS = 10_000;
export const WEB_RATELIMIT_WINDOW_MS = 60_000;
/** notra.js beacons are small; anything larger is not one of them. */
export const GEO_WEB_COLLECT_MAX_BODY_BYTES = 4 * 1024;
/** Cloudflare ray ids, the only request ids a beacon's headers may carry. */
export const GEO_CF_RAY_PATTERN = /^[0-9a-f]{16}-[A-Z]{3}$/;
export const GEO_INGEST_TINYBIRD_TIMEOUT_MS = 5000;
export const GEO_INGEST_MAX_CLOCK_SKEW_FUTURE_MS = 5 * 60 * 1000;
export const GEO_INGEST_MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
export const GEO_INGEST_FLUSH_MAX_ROWS = 1000;
export const GEO_INGEST_MAX_BUFFERED_EVENTS = 50_000;
export const GEO_INGEST_FLUSH_TIMEOUT_MS = 10_000;
export const GEO_INGEST_LIVE_FLUSH_DELAY_MS = 1000;
export const GEO_INGEST_LIVE_RETRY_DELAY_MS = 5000;
export const GEO_INGEST_LIVE_MAX_RETRIES = 3;
export const GEO_INGEST_USAGE_FLUSH_INTERVAL_MS = 5000;
export const GEO_DRAIN_MAX_BODY_BYTES = 16 * 1024 * 1024;
export const GEO_DRAIN_MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
export const GEO_DRAIN_CONCURRENCY = 16;
export const GEO_DRAIN_DEDUPE_KEY_PREFIX = "geo:drain-request:v1";
export const GEO_DRAIN_DEDUPE_TTL_SECONDS = 60 * 60;
export const GEO_DRAIN_GZIP_MAGIC = [0x1f, 0x8b] as const;
export const GEO_DRAIN_RETRYABLE_OUTCOMES = ["rate_limited", "failed"] as const;
export const GEO_DRAIN_CLOUDFLARE_EYEBALL_SOURCE = "eyeball";
export const GEO_DRAIN_TRACING_HEADERS = ["traceparent", "b3", "x-b3-traceid"];
export const GEO_DRAIN_HTTP_STATUS_RANGE = { min: 100, max: 599 } as const;
export const GEO_DRAIN_EPOCH_THRESHOLDS = {
  nanoseconds: 1e17,
  microseconds: 1e14,
  milliseconds: 1e11,
} as const;
export const GEO_DRAIN_NUMERIC_TIMESTAMP_PATTERN = /^\d+(\.\d+)?$/;
export const GEO_SERVER_TRAFFIC_KEY_PREFIX = "geo:server-traffic:v1";
export const GEO_SERVER_TRAFFIC_TTL_SECONDS = 7 * 24 * 60 * 60;
export const GEO_SERVER_TRAFFIC_MARK_INTERVAL_MS = 60 * 60 * 1000;
export const GEO_SERVER_TRAFFIC_MEMO_MS = 5 * 60 * 1000;
export const WEB_DAILY_SALT_KEY_PREFIX = "web:salt:v1";
/**
 * Today's and yesterday's salts must exist around midnight UTC; after that
 * Redis deletes them and stored visitor ids can no longer be recomputed.
 */
export const WEB_DAILY_SALT_TTL_SECONDS = 48 * 60 * 60;

/** How often each process drops cached salts of days that ended over a day ago. */
export const WEB_DAILY_SALT_SWEEP_MS = 60 * 60 * 1000;
export const WEB_DAILY_SALT_BYTES = 32;
export const GEO_WEB_IDENTITY_MEMO_MS = 60 * 1000;
export const GEO_INGEST_MEMO_MAX_ENTRIES = 10_000;
/**
 * notra.js beacons arrive at page-view volume, and anyone can send rejected
 * ones; log 1 in 100 of those (weighted) and every failure.
 */
export const GEO_WEB_COLLECT_LOG_SAMPLE_RATE = 0.01;

export const GEO_INGEST_IDENTITY_POLICIES = {
  server: {
    recordsVisits: false,
    followsRotation: true,
    aiEvents: "tracked",
    marksServerTraffic: true,
    cachesChecks: false,
  },
  // A Site reports every request server-side for AI traffic; people's page
  // views and engagement come from the notra.js beacons it relays. Behind a
  // cookie banner, AI referrals come from those beacons too (see pipeline).
  site: {
    recordsVisits: false,
    followsRotation: false,
    aiEvents: "tracked",
    marksServerTraffic: false,
    cachesChecks: false,
  },
  // Up to three beacons per page view (view, engagement, outbound click).
  "site-beacon": {
    recordsVisits: true,
    followsRotation: false,
    aiEvents: "consented-referrals",
    marksServerTraffic: false,
    cachesChecks: true,
  },
  web: {
    recordsVisits: true,
    followsRotation: true,
    aiEvents: "referrals-without-server",
    marksServerTraffic: false,
    cachesChecks: true,
  },
} as const satisfies Record<GeoIngestIdentityKind, GeoIngestIdentityPolicy>;
