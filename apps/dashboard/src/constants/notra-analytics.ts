/** Notra's own web analytics script host, on Cloudflare's edge. */
export const NOTRA_ANALYTICS_SCRIPT_ORIGIN = "https://static.usenotra.com";

/** Page views go straight to the ingest; the script host only serves files. */
export const NOTRA_ANALYTICS_COLLECT_URL =
  "https://ingest.usenotra.com/api/collect";

export const NOTRA_WEB_KEY = process.env.NEXT_PUBLIC_NOTRA_WEB_KEY;
