export const TRANSIENT_RETRY_MAX_ATTEMPTS = 3;
export const TRANSIENT_RETRY_BASE_DELAY_MS = 500;
export const TRANSIENT_RETRY_MAX_DELAY_MS = 15_000;

export const RETRYABLE_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([
  408, 425, 429, 500, 502, 503, 504,
]);

export const RETRYABLE_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

// Codes fetch puts on a network failure: Bun on the TypeError itself, Node's
// undici on its cause. Other coded TypeErrors, such as ERR_INVALID_URL, are
// bugs that a retry cannot fix.
export const FETCH_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CLOSED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export const RETRYABLE_DATABASE_ERROR_CODES: ReadonlySet<string> = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "40001",
  "40P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);
