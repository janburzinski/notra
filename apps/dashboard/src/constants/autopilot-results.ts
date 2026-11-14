import type { AutopilotJobKind } from "@notra/db/types/autopilot";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kinds whose merged pull request puts a page live that people and AI can visit. */
export const AUTOPILOT_RESULT_KINDS: AutopilotJobKind[] = [
  "keywords",
  "commits",
  "comparisons",
  "refresh",
];

/** Younger merges have too little traffic to say anything. */
export const AUTOPILOT_RESULTS_MIN_AGE_MS = 14 * DAY_MS;
export const AUTOPILOT_RESULTS_MAX_AGE_MS = 180 * DAY_MS;
export const AUTOPILOT_RESULTS_MAX_FINDINGS = 10;
/** Traffic counts cover this many days before the run. */
export const AUTOPILOT_RESULTS_WINDOW_DAYS = 30;
/** Rows read per traffic query; a cut-off answer leaves the pages it may miss unknown. */
export const AUTOPILOT_RESULTS_TRAFFIC_ROWS = 2000;
/** Older findings never stored their file; looked up from the pull request, a few per run. */
export const AUTOPILOT_RESULTS_BACKFILLS_PER_RUN = 5;
