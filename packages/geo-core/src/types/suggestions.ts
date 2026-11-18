import type { geoPromptSuggestions } from "@notra/db/schema";

import type { GeoProduct, GeoPromptIntent, GeoScopeInput } from "./geo";

export type GeoSuggestionRow = typeof geoPromptSuggestions.$inferSelect;
export interface GeoSuggestionInput extends GeoScopeInput {
  suggestionId: string;
}

export interface GeoProductSuggestion {
  id: string;
  productId: string;
  prompt: string;
  intent: GeoPromptIntent | null;
  /** Which gap in the tracked prompts this one covers, in the prompt language. */
  reason: string | null;
  createdAt: string;
}

export interface GeoProductSuggestionsResponse {
  products: GeoProduct[];
  suggestions: GeoProductSuggestion[];
  /** When suggestions were last written for this project; null if never. */
  generatedAt: string | null;
}
