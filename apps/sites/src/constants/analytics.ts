/** notra.js beacons are small; ingest takes at most 4 KiB, like /api/collect. */
export const ANALYTICS_EVENT_MAX_BYTES = 4096;

/**
 * Pages link notra.js with its build version (`?v=`), so a browser keeps that
 * URL for good; any other URL (no version, or one from an older build) gets
 * today's build for an hour.
 */
export const ANALYTICS_SCRIPT_CACHE_CONTROL = "public, max-age=3600";
export const ANALYTICS_SCRIPT_IMMUTABLE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

/**
 * notra.js needs a key to start, but a Site relays its beacons with its own
 * token and drops the key, so any value works.
 */
export const ANALYTICS_SCRIPT_KEY = "site";

/** Query parameter on the beacon endpoint of a 404 page: `?s=404`. */
export const ANALYTICS_STATUS_PARAM = "s";

/** Beacon fields the Site replaces before relaying: key, page URL, referrer. */
export const ANALYTICS_BEACON_PAGE_FIELDS = new Set(["k", "u", "r"]);
