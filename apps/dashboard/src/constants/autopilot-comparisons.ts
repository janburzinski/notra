const DAY_MS = 24 * 60 * 60 * 1000;

/** Answers read for comparison questions. */
export const AUTOPILOT_COMPARISONS_LOOKBACK_MS = 30 * DAY_MS;
export const AUTOPILOT_COMPARISONS_MAX_CHECKS = 3000;
/** A competitor needs this many lost comparison prompts, unless a prompt names it. */
export const AUTOPILOT_COMPARISONS_MIN_LOSSES = 2;
export const AUTOPILOT_COMPARISONS_MAX_EXCERPTS = 4;
export const AUTOPILOT_ANSWER_EXCERPT_MAX_CHARS = 600;
/**
 * Fences what AI answers said in a brief. The writer reads it to see what to
 * beat; fact checks drop it, so an engine's mistake is never a source.
 */
export const AUTOPILOT_ANSWERS_BEGIN =
  "BEGIN AI ANSWERS (what to beat; unverified, never a source of facts)";
export const AUTOPILOT_ANSWERS_END = "END AI ANSWERS";
export const AUTOPILOT_ANSWERS_SECTION =
  /BEGIN AI ANSWERS \(what to beat[^\n]*\n[\s\S]*?\nEND AI ANSWERS\n?/g;
export const AUTOPILOT_COMPARISONS_COMPETITOR_PAGE_MAX_CHARS = 6000;

/** Questions that weigh options: "X vs Y", "alternatives to X", "best X for Y". */
export const AUTOPILOT_COMPARISON_PROMPT_PATTERN =
  /\b(?:vs\.?|versus|alternatives?|compared?|comparison|comparing|better than|instead of|switch(?:ing)? from|best|top \d+|top)\b/i;

export const AUTOPILOT_ALTERNATIVES_PROMPT_PATTERN =
  /\b(?:alternatives?|instead of|switch(?:ing)? from|replace(?:ment)?)\b/i;

/** Repository paths that already hold a comparison page. */
export const AUTOPILOT_COMPARISON_PATH_PATTERN =
  /(?:^|[/_-])(?:vs|versus|compare|comparison|alternatives?)(?:[/_.-]|$)/i;

/** Files that render a page; images and other assets in a compare folder don't count. */
export const AUTOPILOT_PAGE_FILE = /\.(?:mdx?|astro|html?|[jt]sx|vue|svelte)$/;

/** Directories sites keep comparison pages in, preferred over the blog. */
export const AUTOPILOT_COMPARISON_DIRECTORY_HINTS = [
  "content/compare",
  "content/comparisons",
  "content/vs",
  "content/alternatives",
  "src/content/compare",
  "src/content/comparisons",
  "compare",
  "comparisons",
] as const;
