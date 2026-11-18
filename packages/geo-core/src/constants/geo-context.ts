export const GEO_CONTEXT_API_URL = "https://api.context.dev/v1/web/scrape";
export const GEO_CONTEXT_API_KEY_ENV = "CONTEXT_DEV_API_KEY";
export const GEO_CONTEXT_ENGINES = [
  "google/gemini",
  "google/ai-overview",
] as const;
/**
 * Answers a Gemini check through the API with Google Search when neither the
 * Context.dev capture nor its Olostep fallback returned the app's answer.
 */
export const GEO_GEMINI_API_FALLBACK_ENGINE =
  "google/gemini-3.8-flash-grounded";
export const GEO_CONTEXT_TIMEOUT_MS = 110_000;
export const GEO_CONTEXT_PROVIDER_TIMEOUT_MS = 90_000;
export const GEO_CONTEXT_MAX_HTML_BYTES = 8_000_000;
export const GEO_CONTEXT_MAX_RESPONSE_BYTES = 16_000_000;
export const GEO_CONTEXT_MAX_PROMPT_LENGTH = 12_000;
export const GEO_CONTEXT_PARSER_VERSION = 1;
export const GEO_CONTEXT_GOOGLE_ORIGIN = "https://www.google.com";
/** Gemini API search citations point at this redirect, never at the page. */
export const GEO_GEMINI_GROUNDING_REDIRECT_ORIGIN =
  "https://vertexaisearch.cloud.google.com";
export const GEO_CONTEXT_SOURCE_TIMEOUT_MS = 10_000;
export const GEO_CONTEXT_SOURCE_CONCURRENCY = 4;
export const GEO_CONTEXT_BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "h1",
  "h2",
  "h3",
  "h4",
  "li",
  "ul",
  "ol",
  "table",
  "tr",
  "br",
]);
export const GEO_CONTEXT_GEMINI_CHIP_CONTAINER_CLASS =
  "source-inline-chip-container";
export const GEO_CONTEXT_IGNORED_TAGS = new Set([
  "script",
  "style",
  "template",
  "svg",
  "button",
  "nav",
  "sources-carousel-inline",
  "source-footnote",
]);
