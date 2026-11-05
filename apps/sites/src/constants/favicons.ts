export const FAVICON_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";
/** A failed lookup is retried soon instead of pinning the globe for a day. */
export const FAVICON_RETRY_CACHE_CONTROL = "public, max-age=300";
