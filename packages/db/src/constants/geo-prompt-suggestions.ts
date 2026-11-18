/**
 * search_console comes from GSC queries, autopilot from Autopilot's prompt
 * review, product from new prompts written for one of the project's products.
 */
export const GEO_PROMPT_SUGGESTION_SOURCES = [
  "search_console",
  "autopilot",
  "product",
] as const;

export const GEO_PROMPT_SUGGESTION_ACTIONS = ["track", "pause"] as const;
