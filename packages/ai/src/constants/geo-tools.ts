export const GEO_TOOL_DEFAULT_DAYS = 30;
export const GEO_TOOL_MAX_DAYS = 365;
export const GEO_TOOL_DEFAULT_PROMPT_RESULT_LIMIT = 50;
export const GEO_TOOL_MAX_PROMPT_RESULT_LIMIT = 100;
export const GEO_TOOL_DEFAULT_COMPETITOR_LIMIT = 10;
export const GEO_TOOL_MAX_COMPETITOR_LIMIT = 25;
export const GEO_TOOL_TABLE_NOTE =
  "Lists arrive as tables: match each row value to its column. constant holds values shared by every row, same_as names columns equal to another column, and grouped tables key their rows by the group_by value.";

/** Dashboard route that starts a prompt scan for Notra's agent. */
export const GEO_PROMPT_SCAN_INTERNAL_PATH = "/api/internal/geo/prompt-scan";
export const GEO_PROMPT_SCAN_TIMEOUT_MS = 30_000;
/** Prompts the agent sees when its prompt text matched none or several. */
export const GEO_PROMPT_SCAN_CHOICES_LIMIT = 20;
/** Answers the scan result tool returns, prompts times engines times languages. */
export const GEO_SCAN_RESULT_ANSWERS_LIMIT = 60;
export const GEO_SCAN_RESULT_EXCERPT_CHARS = 400;
export const GEO_SCAN_RESULT_COMPETITORS_LIMIT = 5;
/**
 * Loose input bounds for the agents' prompt scan tools. The dashboard checks
 * the request again against geo-core's limits before scanning.
 */
export const GEO_PROMPT_SCAN_INPUT_MAX_LENGTH = 2000;
export const GEO_PROMPT_SCAN_ID_MAX_LENGTH = 128;
export const GEO_PROMPT_SCAN_MAX_ENGINES = 64;
/** Dashboard route that finds tracked prompts for Notra's agent. */
export const GEO_PROMPT_FIND_INTERNAL_PATH = "/api/internal/geo/prompt-find";
