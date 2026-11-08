import { GEO_DRAIN_DOCS_URLS } from "@notra/geo-core/constants/geo";

const GEO_INGEST_SCRIPT_DOCS_URL =
  "https://docs.usenotra.com/ai-traffic/install/script-tag";

/** The guide each install method's footer links to; the package has none. */
export const GEO_INGEST_METHOD_DOCS_URLS = {
  script: GEO_INGEST_SCRIPT_DOCS_URL,
  vercel: GEO_DRAIN_DOCS_URLS.vercel,
  cloudflare: GEO_DRAIN_DOCS_URLS.cloudflare,
  sdk: null,
} as const;

/** How often the install card checks for the first page view while it waits. */
export const GEO_WEB_TRACKING_STATUS_POLL_MS = 5000;
