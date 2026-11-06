export const STATE_TTL_MS = 5000;
export const HOST_TTL_MS = 30_000;
// Host records stay at the edge as long as in an isolate.
export const HOST_EDGE_CACHE_CONTROL = `public, max-age=${HOST_TTL_MS / 1000}`;
export const LOOKUP_CACHE_LIMIT = 128;
export const MANIFEST_CACHE_LIMIT = 32;
// When the value was read from R2, so an edge copy never outlives HOST_TTL_MS.
export const EDGE_READ_AT_HEADER = "X-Notra-Read-At";
// The edge cache is local, so a lookup slower than this counts as a miss.
export const EDGE_READ_TIMEOUT_MS = 1000;
// A read slower than this turns into the "try again" page instead of a hanging request.
export const R2_READ_TIMEOUT_MS = 10_000;
// Logged to Workers Logs, so slow sites show up in observability.
export const SLOW_R2_READ_MS = 1000;
export const SLOW_REQUEST_MS = 3000;
