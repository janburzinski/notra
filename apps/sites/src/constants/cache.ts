export const STATE_TTL_MS = 5000;
export const HOST_TTL_MS = 30_000;
export const LOOKUP_CACHE_LIMIT = 128;
export const MANIFEST_CACHE_LIMIT = 32;
// A read slower than this turns into the "try again" page instead of a hanging request.
export const R2_READ_TIMEOUT_MS = 10_000;
// Logged to Workers Logs, so slow sites show up in observability.
export const SLOW_R2_READ_MS = 1000;
export const SLOW_REQUEST_MS = 3000;
