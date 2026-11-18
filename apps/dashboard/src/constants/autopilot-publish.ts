import type {
  AutopilotApprovalGroup,
  AutopilotApprovals,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";

export const AUTOPILOT_PUBLISH_HOUR = 9;
export const AUTOPILOT_PUBLISH_MIN_HOLD_MS = 24 * 60 * 60 * 1000;
export const AUTOPILOT_PUBLISH_RETRY_MS = 10 * 60 * 1000;
export const AUTOPILOT_PUBLISH_WAIT_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTOPILOT_PUBLISH_BATCH = 5;
/** GitHub's compare lists at most this many files; more can't be checked. */
export const AUTOPILOT_COMPARE_FILE_LIMIT = 300;
export const AUTOPILOT_NO_SITE = "none";
export const AUTOPILOT_WEEKEND_DAYS: ReadonlySet<number> = new Set([0, 6]);

export const AUTOPILOT_DEFAULT_APPROVALS: AutopilotApprovals = {
  posts: "ask",
  updates: "ask",
  fixes: "ask",
};

/**
 * A first setup publishes on its own: the first pull request of each group
 * still waits for a person (AUTOPILOT_HOLD_REASONS.firstPost).
 */
export const AUTOPILOT_SETUP_APPROVALS: AutopilotApprovals = {
  posts: "auto",
  updates: "auto",
  fixes: "auto",
};

/**
 * Files only crawlers and AI agents read, which no build depends on: a fix
 * that changes nothing else may publish like content.
 */
export const AUTOPILOT_SAFE_FIX_FILES = [
  /(^|\/)(llms|llms-full|robots|ai)\.txt$/,
  /(^|\/)sitemap\.xml$/,
];

/** Held pull requests checked per workspace each hour for a hold that cleared. */
export const AUTOPILOT_RESUME_BATCH = 5;

export const AUTOPILOT_APPROVAL_GROUP_BY_KIND: Partial<
  Record<AutopilotJobKind, AutopilotApprovalGroup>
> = {
  keywords: "posts",
  commits: "posts",
  comparisons: "posts",
  refresh: "updates",
  links: "updates",
  landing: "updates",
  rendering: "updates",
  readiness: "fixes",
};

export const AUTOPILOT_NEW_POST_KINDS: AutopilotJobKind[] = [
  "keywords",
  "commits",
  "comparisons",
];

export const AUTOPILOT_FACT_FLAG_HEADINGS = {
  unconfirmed: "Please confirm, about your product with no source",
  figures: "Figures no source contains",
  competitors: "Names competitors, no source checks what it says about them",
} as const;

export const AUTOPILOT_FAILED_CHECK_CONCLUSIONS: ReadonlySet<string> = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
]);

export const AUTOPILOT_FAILED_STATUS_STATES: ReadonlySet<string> = new Set([
  "failure",
  "error",
]);

export const AUTOPILOT_HOLD_PAGE_SIZE = 100;
export const AUTOPILOT_PULL_REQUEST_FILE_PAGES = 3;

export const AUTOPILOT_HOLD_REASONS = {
  firstPost: "The first post waits for you",
  unshipped: "The feature has not shipped yet",
  factCheck: "The fact check flagged claims",
  outsideContent: "Changes files outside the content folder",
  switchedToAsk: "Approvals were set to ask",
  autopilotOff: "Autopilot was turned off",
  closed: "Closed on GitHub",
  draft: "Converted to draft",
  retargeted: "The base branch changed",
  tooBusy: "Too much activity on the pull request to check",
  pushed: "Someone else pushed commits",
  changesRequested: "Changes were requested",
  commented: "Someone commented",
  conflict: "Has a merge conflict",
  checksFailed: "Checks failed",
  blocked: "Branch protection blocks the merge",
  checksStuck: "Checks did not finish",
  held: "Held from the dashboard",
  mergeFailed: "Could not merge",
} as const;

/** Hold reasons saved under an earlier wording, still checked again. */
const AUTOPILOT_LEGACY_HOLD_REASONS = {
  blocked: "Branch protection needs a review",
} as const;

/** Holds checked again before the pull request is ready for review. */
export const AUTOPILOT_RESUMABLE_BEFORE_READY: ReadonlySet<string> = new Set([
  AUTOPILOT_HOLD_REASONS.firstPost,
  AUTOPILOT_HOLD_REASONS.unshipped,
]);

/**
 * Holds from the pull request or the settings that can clear without anyone
 * touching it: checks re-run green, a conflict resolved by the base, a
 * required status reported or a required review given, approvals set back to
 * auto. Holds a person caused (comments, pushes, a manual hold) stay until
 * that person acts.
 */
export const AUTOPILOT_RESUMABLE_AFTER_READY: ReadonlySet<string> = new Set([
  AUTOPILOT_HOLD_REASONS.checksFailed,
  AUTOPILOT_HOLD_REASONS.checksStuck,
  AUTOPILOT_HOLD_REASONS.conflict,
  AUTOPILOT_HOLD_REASONS.blocked,
  AUTOPILOT_LEGACY_HOLD_REASONS.blocked,
  AUTOPILOT_HOLD_REASONS.mergeFailed,
  AUTOPILOT_HOLD_REASONS.switchedToAsk,
  AUTOPILOT_HOLD_REASONS.autopilotOff,
]);
