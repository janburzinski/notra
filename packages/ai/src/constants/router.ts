import type { GatewayId, RouterPolicyConfig } from "@notra/ai/types/router";

export const ROUTER_PROVIDER_OPTIONS_KEY = "notraRouter";
export const ROUTER_METADATA_KEY = "notraRouter";
export const ROUTED_MODEL_PROVIDER = "notra-router";

export const DEFAULT_PLAN_CACHE_TTL_MS = 60_000;
/** Plan/ZDR lookup failures are retried after this instead of the full TTL. */
export const ORGANIZATION_LOOKUP_FAILURE_TTL_MS = 5000;
export const ORGANIZATION_LOOKUP_CACHE_CAPACITY = 10_000;
export const DEFAULT_CREDIT_CHECK_TTL_MS = 30_000;
export const DEFAULT_UNAVAILABLE_TTL_MS = 5 * 60_000;
export const ROUTE_USAGE_LOOKUP_CONCURRENCY = 4;

export const GATEWAY_FALLBACK_ORDER: readonly GatewayId[] = [
  "neon",
  "vercel",
  "openrouter",
];

/** Verified chat-completions IDs from https://neon.com/docs/ai-gateway/overview. */
export const NEON_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "anthropic/claude-sonnet-5": "claude-sonnet-5",
  "anthropic/claude-sonnet-5.5": "claude-sonnet-5-5",
  "anthropic/claude-opus-5.5": "claude-opus-5-5",
  "anthropic/claude-sonnet-4.6": "claude-sonnet-4-6",
  "anthropic/claude-opus-4.6": "claude-opus-4-6",
  "anthropic/claude-haiku-4.5": "claude-haiku-4-5",
  "anthropic/claude-haiku-5.5": "claude-haiku-5-5",
  "anthropic/claude-opus-5": "claude-opus-5",
  "anthropic/claude-fable-5": "claude-fable-5",
  "anthropic/claude-fable-5.1": "claude-fable-5-1",
  "openai/gpt-6-luna": "gpt-6-luna",
  "openai/gpt-6-sol": "gpt-6-sol",
  "openai/gpt-6.1-sol": "gpt-6-1-sol",
  "openai/gpt-6-astra": "gpt-6-astra",
  "openai/gpt-5.6-luna": "gpt-5-6-luna",
  "openai/gpt-5.6-sol": "gpt-5-6-sol",
  "openai/gpt-5.6-terra": "gpt-5-6-terra",
  "openai/gpt-5.5": "gpt-5-5",
  "openai/gpt-5.4": "gpt-5-4",
  "openai/gpt-5.4-mini": "gpt-5-4-mini",
  "openai/gpt-5.4-nano": "gpt-5-4-nano",
  "openai/gpt-5-mini": "gpt-5-mini",
  "openai/gpt-oss-120b": "gpt-oss-120b",
  "openai/gpt-oss-20b": "gpt-oss-20b",
  "google/gemini-3-flash": "gemini-3-flash",
  "google/gemini-3.5-flash": "gemini-3-5-flash",
  "google/gemini-3.8-flash": "gemini-3-8-flash",
  "google/gemini-3.1-pro-preview": "gemini-3-1-pro",
  "spacexai/grok-4.7": "grok-4-7",
  "moonshotai/kimi-k3": "kimi-k3",
  "zai/glm-5.3": "glm-5-3",
  "meta/llama-4-maverick": "llama-4-maverick",
};

/** Prefixes Neon/Databricks put on served ids, e.g. `global.xai.grok-4.7`. */
export const NEON_SERVED_MODEL_PREFIX_PATTERN =
  /^(?:databricks-|global\.[a-z]+\.)/;

/** Snapshot suffixes on served ids, e.g. `gpt-5.4-nano-2026-03-17`, `gpt-oss-120b-080525`. */
export const NEON_SERVED_MODEL_SUFFIX_PATTERN =
  /-(?:\d{4}-\d{2}-\d{2}|\d{6,8})$/;

export const DEFAULT_OPENROUTER_ACCOUNT_BASE_URL =
  "https://openrouter.ai/api/v1";

export const OPENROUTER_PRIVACY_PROVIDER_ROUTING = {
  zdr: true,
  data_collection: "deny",
} as const;

export const VERCEL_NAMESPACE_PREFIX = "vercel/";

export const VERCEL_SERVED_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "gpt-5.4": "openai/gpt-5.4",
  "gpt-5.4-mini": "openai/gpt-5.4-mini",
  "gpt-5.4-nano": "openai/gpt-5.4-nano",
  "gpt-5.6-sol": "openai/gpt-5.6-sol",
  "gpt-6-luna": "openai/gpt-6-luna",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
  "claude-opus-4-6": "anthropic/claude-opus-4.6",
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-sonnet-5": "anthropic/claude-sonnet-5",
  "claude-opus-5-5": "anthropic/claude-opus-5.5",
  "claude-opus-5.5": "anthropic/claude-opus-5.5",
};

export const OPENROUTER_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "google/gemini-3-flash": "google/gemini-3-flash-preview",
  "meta/llama-4-maverick": "meta-llama/llama-4-maverick",
  "meta/llama-4-scout": "meta-llama/llama-4-scout",
  "meta/llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
  "meta/llama-3.1-70b": "meta-llama/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct",
  "mistral/mistral-medium-3.5": "mistralai/mistral-medium-3-5",
  "mistral/mistral-large-3": "mistralai/mistral-large-2512",
  "spacexai/grok-4.7": "x-ai/grok-4.7",
  "spacexai/grok-4.6": "x-ai/grok-4.6",
  "spacexai/grok-4.5": "x-ai/grok-4.5",
  "spacexai/grok-build-0.1": "x-ai/grok-build-0.1",
  "spacexai/grok-4.3": "x-ai/grok-4.3",
  "spacexai/grok-4.20-multi-agent": "x-ai/grok-4.20-multi-agent",
  "zai/glm-5.3-flash": "z-ai/glm-5.3-flash",
  "zai/glm-5.3": "z-ai/glm-5.3",
  "zai/glm-5.2": "z-ai/glm-5.2",
  "zai/glm-5.1": "z-ai/glm-5.1",
  "zai/glm-5v-turbo": "z-ai/glm-5v-turbo",
  "zai/glm-5-turbo": "z-ai/glm-5-turbo",
  "zai/glm-5": "z-ai/glm-5",
  "zai/glm-4.7-flash": "z-ai/glm-4.7-flash",
};

const RETIRED_MODELS = ["mistral/magistral-medium"];

export const OPENROUTER_UNSUPPORTED_MODELS: ReadonlySet<string> = new Set([
  "moonshotai/kimi-k2.7-code-highspeed",
  "zai/glm-5.3-promo-50",
  "zai/glm-4.7-flashx",
  "spacexai/grok-4.20-non-reasoning",
  "spacexai/grok-4.20-reasoning",
  "spacexai/grok-4.1-fast-non-reasoning",
  "spacexai/grok-4.1-fast-reasoning",
  "deepseek/deepseek-v3.2-thinking",
  "deepseek/deepseek-v3.1",
  "mistral/mistral-medium",
  "mistral/mistral-small",
  ...RETIRED_MODELS,
]);

export const VERCEL_UNSUPPORTED_MODELS: ReadonlySet<string> = new Set(
  RETIRED_MODELS
);

export const VERCEL_OPTIONS_KEY = "gateway";
export const OPENROUTER_OPTIONS_KEY = "openrouter";

export const OPENROUTER_EFFORTS: ReadonlySet<string> = new Set([
  "xhigh",
  "high",
  "medium",
  "low",
  "minimal",
  "none",
]);

export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_PAYMENT_REQUIRED = 402;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_REQUEST_TIMEOUT = 408;
export const HTTP_CONFLICT = 409;
export const HTTP_TOO_EARLY = 425;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_SERVER_ERROR_MIN = 500;
/**
 * Vercel AI Gateway rejects a request that has no ZDR-capable provider with
 * 400 `no_providers_available` ("No ZDR (Zero Data Retention) providers
 * available for model: ..."); team-plan gating surfaces as 403.
 */
export const ZDR_ERROR_PATTERN =
  /zero data retention|\bzdr\b|no_providers_available/i;
export const ZDR_REJECTION_STATUS_CODES: ReadonlySet<number> = new Set([
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
]);
/**
 * OpenRouter answers 404 "No endpoints found matching your data policy" when
 * `provider.zdr` filters every host away. That is a ZDR rejection, not an
 * unknown model.
 */
export const OPENROUTER_NO_ZDR_ENDPOINT_PATTERN =
  /no endpoints found.*(data policy|zero data retention|\bzdr\b)/i;

export const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([
  HTTP_REQUEST_TIMEOUT,
  HTTP_CONFLICT,
  HTTP_TOO_EARLY,
  HTTP_TOO_MANY_REQUESTS,
]);

export const ROUTER_POLICY = {
  defaultGateway: "neon",
  paidGateway: "neon",
  freeGateway: "neon",
  allowNonZdr: process.env.NODE_ENV === "development",
  crossGatewayFallback: true,
} satisfies RouterPolicyConfig;

/**
 * Neon answers 429 `REQUEST_LIMIT_EXCEEDED` once the account's daily spend
 * cap is hit ("ai gateway daily token limit exceeded"); it lasts until the
 * day resets, unlike the per-minute token limit.
 */
export const DAILY_LIMIT_ERROR_PATTERN = /\bdaily\b[^.]*limit exceeded/i;

export const NO_TRAINING_PROVIDER_ERROR_PATTERN =
  /No providers that disallow prompt training available for model:/i;
