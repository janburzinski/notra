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
export const AUTOPILOT_NO_SITE = "none";
export const AUTOPILOT_WEEKEND_DAYS: ReadonlySet<number> = new Set([0, 6]);

export const AUTOPILOT_DEFAULT_APPROVALS: AutopilotApprovals = {
  posts: "ask",
  updates: "ask",
  fixes: "ask",
};

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
} as const;

export const AUTOPILOT_FAILED_CHECK_CONCLUSIONS: ReadonlySet<string> = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
]);

export const AUTOPILOT_HOLD_PAGE_SIZE = 100;

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
  blocked: "Branch protection needs a review",
  checksStuck: "Checks did not finish",
  held: "Held from the dashboard",
  mergeFailed: "Could not merge",
} as const;
