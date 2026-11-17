/**
 * A new post's page did not exist before it merged, so every AI answer that
 * cites it and every assistant fetch of it comes from the post: unlike the
 * brand's mention share, the baseline is zero and needs no before window.
 */
export const AUTOPILOT_OUTCOME_MIN_CITATIONS = 2;
/** Assistant fetches while answering plus clicks from an AI assistant. */
export const AUTOPILOT_OUTCOME_MIN_AI_VISITS = 3;
/** Younger posts are never called a miss: engines need weeks to find a page. */
export const AUTOPILOT_OUTCOME_MISS_AFTER_DAYS = 45;
/** Answers scanned since the merge before "never cited" means anything. */
export const AUTOPILOT_OUTCOME_MIN_ANSWERS = 50;
/** Answers read per page when looking for citations; a prefilter keeps it small. */
export const AUTOPILOT_OUTCOME_MAX_CITING_ROWS = 2000;
/** Posts measured per run, least recently measured first. */
export const AUTOPILOT_OUTCOME_MAX_FINDINGS = 25;
/** A post is measured at most this often; the planner and the refresh job both ask. */
export const AUTOPILOT_OUTCOME_RECHECK_MS = 20 * 60 * 60 * 1000;
