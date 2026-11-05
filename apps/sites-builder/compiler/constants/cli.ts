export const LOCAL_SITE_ID = "local";
export const LOCAL_BUILD_ORIGIN = "http://localhost";

export const USAGE = `notra-sites <command>

  validate [--source <dir>] [--target <file>] [--json]  Check settings, MDX and snippets
  build [--source <dir>] --out <dir> [--target <file>] [--mount <area>=<path>]... [--origin <url>] [--json]
  dev [--source <dir>] [--target <file>] [--mount <area>=<path>]... [--area blog|changelog] [--port 4321]

  dev and build serve the areas with a folder (both when neither has one) at /blog and /changelog, or those in --target.
  --mount blog=/newsroom serves only the areas listed, at those paths, and replaces the mounts of --target.
  build without --target makes a local build: noindex, no drafts, links on --origin (default ${LOCAL_BUILD_ORIGIN}).
  --area picks where "/" redirects in dev and, without --target or --mount, also serves that area.`;

export const DEV_READY_TIMEOUT_MS = 60_000;
export const DEV_PORT_SEARCH_RANGE = 100;
export const ASTRO_READY_URL = /http:\/\/127\.0\.0\.1:(\d+)(?=\D)/;
export const ASTRO_READY_SCAN_CHARS = 512;
export const DEV_STOP_TIMEOUT_MS = 5000;
export const DEV_HMR_GENERATION_EVENT = "notra:page-generation";
export const DEV_ERRORS_PATH = "/__notra-dev/errors";
export const DEV_ERRORS_POLL_MS = 1000;
export const DEV_PROXY_MAX_ATTEMPTS = 3;
export const DEV_PROXY_RETRY_DELAY_MS = 50;
export const DEV_PROXY_RETRY_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);
export const DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEV_FAVICON_URL = "https://www.google.com/s2/favicons";
