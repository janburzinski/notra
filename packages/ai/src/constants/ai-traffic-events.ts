export const AI_TRAFFIC_EVENTS_QUOTA_CACHE_CAPACITY = 10_000;
export const AI_TRAFFIC_EVENTS_QUOTA_CACHE_TTL_MS = 60_000;
/** Autumn did not apply the request: rate limited or unavailable. */
export const AI_TRAFFIC_EVENTS_TRACK_RETRYABLE_STATUS_CODES: ReadonlySet<number> =
  new Set([429, 503]);
