const DAY_MS = 24 * 60 * 60 * 1000;

/** Merged pages followed until Google indexed them, at most this long. */
export const AUTOPILOT_LIVE_FOLLOW_MS = 30 * DAY_MS;
/** A merged page that doesn't load after this long is named in the brief. */
export const AUTOPILOT_LIVE_GRACE_MS = 3 * DAY_MS;
/** Google gets this long after a page went live before the brief says it isn't indexed. */
export const AUTOPILOT_INDEX_GRACE_MS = 14 * DAY_MS;
/** One URL inspection per page per this long; the API allows 2000 a day per property. */
export const AUTOPILOT_INDEX_CHECK_INTERVAL_MS = 2 * DAY_MS;
export const AUTOPILOT_INDEXED_VERDICT = "PASS";
/** Merged pages checked per run. */
export const AUTOPILOT_LIVE_MAX_FINDINGS = 10;
/** Sitemap URLs read when looking for a new post by its slug. */
export const AUTOPILOT_LIVE_SITEMAP_MAX_LINKS = 5;
export const AUTOPILOT_LIVE_SITEMAP_TIMEOUT_MS = 30_000;
