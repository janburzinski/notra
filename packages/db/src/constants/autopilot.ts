export const AUTOPILOT_JOB_KINDS = [
  "readiness",
  "keywords",
  "commits",
  "prompts",
  "competitors",
  "refresh",
  "comparisons",
  "rendering",
  "links",
  "landing",
] as const;

/**
 * The automations the dashboard lists: the jobs that open pull requests.
 * prompts suggests pauses on the Prompts page and competitors is a line in
 * the brief, so neither has pull requests or merges to count.
 */
export const AUTOPILOT_AUTOMATION_KINDS = [
  "readiness",
  "keywords",
  "commits",
  "refresh",
  "comparisons",
  "rendering",
  "links",
  "landing",
] as const satisfies readonly (typeof AUTOPILOT_JOB_KINDS)[number][];

/**
 * Templates added after launch start off; a workspace turns them on. A stored
 * `jobs` value only holds the keys a workspace changed, so read it on top of
 * this.
 */
export const AUTOPILOT_DEFAULT_JOBS = {
  readiness: true,
  keywords: true,
  commits: true,
  prompts: true,
  competitors: true,
  refresh: false,
  comparisons: false,
  rendering: false,
  links: false,
  landing: false,
} as const satisfies Record<(typeof AUTOPILOT_JOB_KINDS)[number], boolean>;

/**
 * manual, cron and onboarding run every job and never overlap. github (a
 * `@notra` mention or a merge) and suggestion (writing a dashboard
 * suggestion) handle one item and may run next to them.
 */
export const AUTOPILOT_RUN_TRIGGERS = [
  "manual",
  "cron",
  "onboarding",
  "github",
  "suggestion",
] as const;

/** Full runs; only one of these runs per workspace at a time. */
export const AUTOPILOT_SCHEDULED_TRIGGERS = [
  "manual",
  "cron",
  "onboarding",
] as const;

/**
 * How many repositories a workspace may pick for "Write about releases". Each
 * one costs a few GitHub list calls per run.
 */
export const AUTOPILOT_MAX_SOURCE_REPOSITORIES = 15;

export const AUTOPILOT_RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "stopped",
] as const;

/**
 * suggested: Jev thought it was worth a post but not sure enough to open a
 * pull request. expired: Autopilot closed its own draft because nobody worked
 * on it; unlike dismissed it is not a "no", so the topic may come back.
 */
export const AUTOPILOT_FINDING_STATUSES = [
  "suggested",
  "open",
  "proposed",
  "merged",
  "dismissed",
  "expired",
  "failed",
] as const;

/**
 * skip: a gate stopped the job, decision: a filter or model picked something,
 * action: Autopilot changed something (LLM call, pull request), error: it failed.
 */
/**
 * `data.kind` of an admin-only event recording one agent loop step: its
 * model, tokens, duration and tool names. The raw step stays in `detail`.
 */
export const AUTOPILOT_AGENT_STEP_EVENT_KIND = "agent-step";

export const AUTOPILOT_EVENT_LEVELS = [
  "info",
  "skip",
  "decision",
  "action",
  "error",
] as const;

export const AUTOPILOT_APPROVAL_GROUPS = ["posts", "updates", "fixes"] as const;

export const AUTOPILOT_APPROVAL_MODES = ["ask", "auto"] as const;

/**
 * When owners get an email about a new draft. without_slack: only when no
 * Slack channel gets the brief. always: also when one does.
 */
export const AUTOPILOT_DRAFT_EMAIL_MODES = ["without_slack", "always"] as const;

/** Reviewers a workspace may name; GitHub takes at most 15 per pull request. */
export const AUTOPILOT_MAX_WORKSPACE_REVIEWERS = 10;
/**
 * A GitHub user (`octocat`) or a team in the repository's organization
 * (`acme/docs`), with or without a leading @.
 */
export const AUTOPILOT_REVIEWER_PATTERN =
  /^@?[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99})?$/;
