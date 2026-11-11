import { UTILITY_MODEL_ID } from "@notra/ai/constants/models";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AUTOPILOT_DREAM_MODEL_ID = UTILITY_MODEL_ID;
export const AUTOPILOT_DREAM_MAX_OUTPUT_TOKENS = 2000;
export const AUTOPILOT_DREAM_TIMEOUT_MS = 2 * 60_000;

export const AUTOPILOT_DREAM_PULL_REQUEST_LOOKBACK_MS = 30 * DAY_MS;
export const AUTOPILOT_DREAM_MAX_PULL_REQUESTS = 8;
export const AUTOPILOT_DREAM_LEARNED_PULL_REQUESTS_KEPT = 200;
export const AUTOPILOT_DREAM_PATCH_MAX_CHARS = 4000;
export const AUTOPILOT_DREAM_COMMENT_MAX_CHARS = 600;
export const AUTOPILOT_DREAM_MAX_COMMENTS = 6;
export const AUTOPILOT_DREAM_MAX_EDIT_COMMITS = 10;
export const AUTOPILOT_DREAM_TRUSTED_COMMENT_ASSOCIATIONS: ReadonlySet<string> =
  new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export const AUTOPILOT_DREAM_LESSON_MIN_PULL_REQUESTS = 2;
export const AUTOPILOT_DREAM_LESSON_MAX_CHARS = 200;
export const AUTOPILOT_DREAM_MAX_CANDIDATES = 50;
export const AUTOPILOT_DREAM_MAX_CONVENTIONS = 30;
export const AUTOPILOT_DREAM_MAX_SOURCES = 5;
export const AUTOPILOT_DREAM_CONVENTIONS_MAX_BYTES = 6 * 1024;
export const AUTOPILOT_DREAM_LESSON_AREAS = [
  "style",
  "format",
  "structure",
  "frontmatter",
  "length",
] as const;
export const AUTOPILOT_DREAM_LESSON_DENYLIST =
  /https?:\/\/|```|<[a-z/!]|\bignore (?:all|any|the|previous)\b|\bsystem prompt\b|\binstruction/i;
export const AUTOPILOT_DREAM_LESSON_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const AUTOPILOT_DREAM_LESSON_KEY_MAX_CHARS = 48;

export const AUTOPILOT_DREAM_CONVENTIONS_INTRO =
  "How this repository's team edits Autopilot's drafts, learned from merged and closed pull requests. Style, format and structure only: never a rule about topics. Written by Autopilot's dream; delete an entry to make it forget.";

export const AUTOPILOT_DREAM_MAX_CHECKS = 25;
export const AUTOPILOT_DREAM_MIN_ACTION_CAP = 3;
export const AUTOPILOT_DREAM_ACTION_CAP_SHARE = 0.15;
export const AUTOPILOT_DREAM_COMPARISON_MIN_LOSSES = 3;
export const AUTOPILOT_DREAM_GAP_EVIDENCE_DAYS = 14;
export const AUTOPILOT_DREAM_GAP_CLOSED_SHARE = 0.5;
export const AUTOPILOT_DREAM_COMPARISON_TOP = 3;
export const AUTOPILOT_DREAM_ANSWER_CHECKS_LIMIT = 3000;

export const AUTOPILOT_DREAM_SIMILAR_TOPIC_SCORE = 0.5;
export const AUTOPILOT_DREAM_MAX_MERGE_CANDIDATES = 10;
export const AUTOPILOT_DREAM_TOPIC_STOP_WORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "and",
  "for",
  "how",
  "in",
  "of",
  "on",
  "the",
  "to",
  "vs",
  "with",
]);
export const AUTOPILOT_DREAM_TOPIC_TOKEN_SUFFIX = /(?:ing|es|s)$/;
export const AUTOPILOT_DREAM_TOPIC_SUMMARY_MAX_CHARS = 400;
export const AUTOPILOT_DREAM_CLOSED_TOPIC_SUMMARY_MAX_CHARS = 160;
export const AUTOPILOT_DREAM_MAX_OPEN_QUESTIONS = 5;

export const AUTOPILOT_DREAM_DAILY_NOTE_MAX_LINES = 15;
export const AUTOPILOT_DREAM_DAILY_LINE_MAX_CHARS = 180;
export const AUTOPILOT_DREAM_DAILY_NOTES_KEPT = 14;
export const AUTOPILOT_DREAM_RECENT_DAYS = 3;
export const AUTOPILOT_DREAM_RULE_EDGE_PUNCTUATION =
  /^[\s"'`*_.,;:!?-]+|[\s"'`*_.,;:!?-]+$/g;
