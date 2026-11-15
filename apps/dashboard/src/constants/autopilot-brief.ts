import type {
  AutopilotBriefHeadings,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";

/** Daily briefs are plain pages at /brief/:id, outside the dashboard shell. */
export const AUTOPILOT_BRIEFS_PATH = "/brief";

export const AUTOPILOT_BRIEF_MAX_SECTIONS = 4;
export const AUTOPILOT_BRIEF_HEADLINE_MAX = 70;
export const AUTOPILOT_BRIEF_SUMMARY_MAX = 400;
export const AUTOPILOT_BRIEF_LEAD_MAX = 240;
export const AUTOPILOT_BRIEF_SECTION_TITLE_MAX = 80;
export const AUTOPILOT_BRIEF_SECTION_BODY_MAX = 900;
export const AUTOPILOT_BRIEF_MAX_OUTPUT_TOKENS = 1500;

/**
 * How often an open brief re-reads its items while some still wait for a
 * decision, so a 👍 in Slack or a merge elsewhere shows up without a reload.
 */
export const AUTOPILOT_BRIEF_REFRESH_MS = 30_000;

/** Brief ids are nanoids; anything else is a 404 before touching the database. */
export const AUTOPILOT_BRIEF_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Section bodies separate paragraphs with a blank line. */
export const AUTOPILOT_BRIEF_PARAGRAPH_BREAK = /\n\s*\n/;

/** Where each kind of item comes from, for the brief's "made from" footer. */
export const AUTOPILOT_BRIEF_SOURCES: Record<AutopilotJobKind, string> = {
  readiness: "your site",
  keywords: "AI answers",
  commits: "GitHub",
  prompts: "AI answers",
  competitors: "AI answers",
  refresh: "AI answers",
  comparisons: "AI answers",
  rendering: "your site",
  links: "Search Console",
  landing: "AI answers",
};

/**
 * Headings the brief's artifact puts above its parts. The model translates
 * them into the brand's language; these are the originals and the fallback.
 */
export const AUTOPILOT_BRIEF_ARTIFACT_HEADINGS: AutopilotBriefHeadings = {
  waiting: "Waiting for you",
  alsoWaiting: "Also waiting",
  merged: "Merged",
  worthKnowing: "Worth knowing",
};

export const AUTOPILOT_BRIEF_HEADING_MAX = 40;
