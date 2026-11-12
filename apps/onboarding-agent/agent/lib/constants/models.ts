export const ONBOARDING_MODEL_ID = "zai/glm-5.3-flash";
export const ONBOARDING_FALLBACK_MODEL_ID = "anthropic/claude-sonnet-5";
export const GLM_CONTEXT_WINDOW_TOKENS = 1_048_576;
// Healthy calls start streaming within ~5s; a stalled provider otherwise
// holds the call until the HTTP client's 5 minute headers timeout.
export const MODEL_FIRST_CHUNK_TIMEOUT_MS = 60_000;
