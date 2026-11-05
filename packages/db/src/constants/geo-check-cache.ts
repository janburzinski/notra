// Keys include the check generation, so entries only go stale when a bump
// fails (Redis unavailable); the TTL bounds that.
const GEO_CHECK_AGGREGATE_TTL_SECONDS = 60 * 60;

export const GEO_CHECK_AGGREGATE_CACHE = {
  autoInvalidate: false,
  config: { ex: GEO_CHECK_AGGREGATE_TTL_SECONDS },
} as const;

export const GEO_CHECK_GENERATION_KEY_PREFIX = "geo:checkgen";
export const GEO_CHECK_AGGREGATE_TAG_PREFIX = "geo:checkagg";
export const GEO_CHECK_GENERATION_TTL_SECONDS = 60 * 60 * 24 * 7;
// A missing counter starts at Date.now() times this, above any value it held.
export const GEO_CHECK_GENERATION_SEED_PER_MS = 1000;
