export const DEFAULT_AXIOM_AI_DATASET = "ai-logs";
export const DEFAULT_AXIOM_GEO_DATASET = "notra-geo-scan";
export const GEO_LOG_EVENT_PREFIX = "geo.";
export const REQUEST_AI_USAGE_FIELDS = new Set([
  "calls",
  "model",
  "models",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
  "costUsd",
]);
export const AXIOM_PERMANENT_ERROR_PATTERN =
  /^Axiom API error: (401|403|404)\b/;
// evlog's throwing OTLP sender prefixes HTTP errors before any response body.
export const OTLP_AUTH_ERROR_PATTERN = /^OTLP API error: (401|403|404)\b/;
export const LOG_TRANSPORT_TIMEOUT_MS = 3000;
export const LOG_PIPELINE_OPTIONS = {
  batch: { size: 50, intervalMs: 2000 },
  retry: { maxAttempts: 3, initialDelayMs: 250, maxDelayMs: 1000 },
  maxBufferSize: 1000,
};
