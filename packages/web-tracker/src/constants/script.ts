export const TRACKER_SCRIPT_CONTENT_TYPE = "text/javascript; charset=utf-8";

export const TRACKER_SCRIPT_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

/**
 * A pinned build never changes, so caches keep it for a year; no-transform
 * stops proxies and CDNs from minifying or rewriting the bytes its integrity
 * hash covers. Compression is fine: SRI checks the decoded body.
 */
export const TRACKER_RELEASE_CACHE_CONTROL =
  "public, max-age=31536000, immutable, no-transform";

/** Hex characters of the sha256 of a build that name its version. */
export const TRACKER_VERSION_LENGTH = 12;

/** `notra.<version>.js` or `notra.plus.<version>.js`, nothing else. */
export const TRACKER_RELEASE_FILE_PATTERN =
  /^notra(\.plus)?\.([0-9a-f]{12})\.js$/;
