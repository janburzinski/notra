export const SITES_INTERNAL_PATH = "/api/internal/sites/authors";

/** Reads and draft saves wait on GitHub; a publish also checks the whole site and commits. */
export const SITES_INTERNAL_TIMEOUT_MS = 25_000;
export const SITES_PUBLISH_TIMEOUT_MS = 90_000;

export const SITES_UNAVAILABLE_ERROR =
  "Notra Sites is not available right now. Try again later.";
