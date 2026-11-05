import type { ReportEngine } from "../shared";

export const OLOSTEP_REPORT_ENGINES: Partial<Record<ReportEngine, string>> = {
  chatgpt: "openai/chatgpt",
};

/** Perplexity uses its API: Olostep's Perplexity parser returned no result for 1,061 of 1,199 batches in 2026-11. */
export const API_REPORT_ENGINES = ["claude", "perplexity"] as const;

export const CONTEXT_REPORT_ENGINES: Partial<Record<ReportEngine, string>> = {
  gemini: "google/gemini",
  "ai-overview": "google/ai-overview",
};

export const REPORT_CAPTURE_METHOD = "olostep-context-v1";
/** "- item", "* item" or "1. item" in a captured AI Overview answer. */
export const OVERVIEW_LIST_ITEM = /^(?:[-*•]|\d+[.)])\s+(.+)$/;
export const OVERVIEW_HEADING_MAX_LENGTH = 120;
/** Lists shorter than this are never treated as carrying inlined source labels. */
export const OVERVIEW_LABEL_MIN_ITEMS = 3;
export const OLOSTEP_REPORT_WAIT_MS = 10 * 60 * 1000;
export const OLOSTEP_REPORT_POLL_MS = 10_000;
