export const SITES_INTERNAL_PATH = "/api/internal/sites/authors";

/** Reads and draft saves wait on GitHub; a publish also checks the whole site and commits. */
export const SITES_INTERNAL_TIMEOUT_MS = 25_000;
export const SITES_PUBLISH_TIMEOUT_MS = 90_000;

export const SITES_UNAVAILABLE_ERROR =
  "Notra Sites is not available right now. Try again later.";

export const SITES_API_INTERNAL_PATH = "/api/internal/sites/api";
/** Publishing a post writes to GitHub; reads finish well within this. */
export const SITES_API_INTERNAL_TIMEOUT_MS = 60_000;
/** Statuses the dashboard returns with a message safe to pass through. */
export const SITES_API_FORWARDED_STATUSES = [
  400, 402, 403, 404, 409, 429, 503,
] as const;
