export const GEO_CONSUMER_APP_GATEWAYS: ReadonlySet<string> = new Set([
  "olostep",
  "context",
]);

export const GEO_PROVIDER_PREFERRED_ENGINES: ReadonlySet<string> = new Set([
  "anthropic/claude-haiku-5.5",
]);

/**
 * Engines that get a picker row of their own, in display order, ahead of the
 * rest of their provider. Google's search surfaces are different products
 * from the Gemini models.
 */
export const GEO_PICKER_ENGINE_ROWS: Readonly<
  Record<string, { id: string; label: string; featured: boolean }>
> = {
  "google/ai-mode": {
    id: "google-ai-mode",
    label: "Google AI Mode",
    featured: true,
  },
  "google/ai-overview": {
    id: "google-ai-overview",
    label: "Google AI Overview",
    featured: true,
  },
};

export const GEO_CODING_AGENT_PROVIDERS: ReadonlySet<string> = new Set([
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "fx",
]);

/** Picker names where the catalog's provider name is ambiguous. */
export const GEO_PICKER_PROVIDER_LABELS: Readonly<Record<string, string>> = {
  google: "Google Gemini",
};
