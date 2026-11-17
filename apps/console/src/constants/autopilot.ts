import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type { ChartConfig } from "@notra/ui/components/ui/chart";

import type { AutopilotHealthColumn } from "@/types/autopilot";

export const AUTOPILOT_ADMIN_PATH = "/api/internal/autopilot/admin";
export const AUTOPILOT_ADMIN_PAGE_SIZE = 50;
export const AUTOPILOT_ADMIN_POLL_MS = 15_000;
export const AUTOPILOT_ADMIN_REQUEST_TIMEOUT_MS = 20_000;
export const AUTOPILOT_HEARTBEAT_WARNING_MS = 5 * 60 * 1000;
/** Waterfall axis spacing; the first that keeps it to eight ticks wins. */
export const AUTOPILOT_TIMELINE_TICK_STEPS_MS = [
  1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000,
  1_800_000, 3_600_000,
];
export const AUTOPILOT_TIMELINE_MAX_TICKS = 8;
/** Steps logged before step telemetry existed only have a message. */
export const AUTOPILOT_LEGACY_STEP_MESSAGE = /^(?:Agent|Writer) step (\d+)$/;
export const AUTOPILOT_AGENT_PROMPT_MESSAGE = /prompt$/i;
export const AUTOPILOT_OPENED_PULL_REQUEST = /^Opened pull request #/;
/** A failed structured call: "Retrying <model> (<tag>)". */
export const AUTOPILOT_RETRY_MESSAGE = /^Retrying (\S+) \(/;
export const AUTOPILOT_RUN_LANE = "run";

/** Data fields a span's tooltip already shows in its own rows. */
export const AUTOPILOT_SPAN_DATA_FIELDS = new Set([
  "kind",
  "step",
  "steps",
  "model",
  "durationMs",
  "inputTokens",
  "outputTokens",
  "cachedInputTokens",
  "reasoningTokens",
  "tools",
  "finishReason",
]);

/** Tooltip rows per event, and characters per value, before cutting off. */
export const AUTOPILOT_TOOLTIP_MAX_DETAILS = 6;
export const AUTOPILOT_TOOLTIP_MAX_VALUE_CHARS = 90;

/** A step's end event lands just before its loop's finish event. */
export const AUTOPILOT_STEP_PARENT_SLACK_MS = 2000;

/** AI SDK finish reasons, as a sentence for the tooltip. */
export const AUTOPILOT_FINISH_REASON_LABEL: Record<string, string> = {
  stop: "Answered",
  "tool-calls": "Called tools",
  length: "Hit the output token limit",
  "content-filter": "Blocked by the content filter",
  error: "Errored",
};

export const AUTOPILOT_HEALTH_RANGE_OPTIONS = [
  { value: 1, label: "24 hours" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
] as const;
export const AUTOPILOT_HEALTH_DEFAULT_DAYS = 7;
export const AUTOPILOT_HEALTH_MAX_DAYS = 90;
export const AUTOPILOT_HEALTH_REFETCH_MS = 60_000;
export const AUTOPILOT_HEALTH_FAILURE_LIMIT = 12;
export const AUTOPILOT_HEALTH_WORKSPACE_LIMIT = 50;
export const AUTOPILOT_HEALTH_WORKFLOW_LIMIT = 10;
export const AUTOPILOT_HEALTH_STUCK_LIMIT = 10;
/** Error messages are grouped by their first characters. */
export const AUTOPILOT_HEALTH_MESSAGE_CHARS = 160;
/** Prefix of a custom workflow's `workflow_runs.workflow_key`. */
export const AUTOPILOT_CUSTOM_WORKFLOW_KEY_PREFIX = "autopilot.custom.";
/** Below this many failed runs a failure rate says little. */
export const AUTOPILOT_HEALTH_MIN_FAILED_RUNS = 3;
/** Below this many merged or closed drafts a merge rate says little. */
export const AUTOPILOT_HEALTH_MIN_DECIDED = 5;
/** A template whose drafts are merged less often than this is flagged. */
export const AUTOPILOT_HEALTH_LOW_MERGE_RATE = 0.25;
/** A template failing in more runs than this share is flagged. */
export const AUTOPILOT_HEALTH_HIGH_FAILURE_RATE = 0.2;

/** The names workspaces see on the dashboard's Autopilot page. */
export const AUTOPILOT_JOB_LABELS: Record<AutopilotJobKind, string> = {
  readiness: "Fix agent readiness",
  rendering: "Make pages readable for AI",
  keywords: "Write for content gaps",
  refresh: "Refresh pages AI stopped citing",
  comparisons: "Write comparison pages",
  links: "Add internal links",
  landing: "Update landing page copy",
  commits: "Write about releases",
  prompts: "Suggest prompt pauses",
  competitors: "Competitors in the brief",
};

export const AUTOPILOT_HEALTH_RUNS_CONFIG = {
  completed: { label: "Completed", color: "var(--chart-2)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  stopped: { label: "Stopped", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export const AUTOPILOT_HEALTH_TEMPLATE_COLUMNS = [
  { label: "Template" },
  { label: "On in", numeric: true },
  { label: "Runs", numeric: true },
  { label: "Failed", numeric: true },
  { label: "Ideas", numeric: true },
  { label: "Drafts", numeric: true },
  { label: "Merged", numeric: true },
  { label: "Closed", numeric: true },
  { label: "Merge rate", numeric: true },
  { label: "Waiting", numeric: true },
  { label: "Credits", numeric: true },
] as const satisfies readonly AutopilotHealthColumn[];

export const AUTOPILOT_HEALTH_FAILURE_COLUMNS = [
  { label: "Error" },
  { label: "Runs", numeric: true },
  { label: "Workspaces", numeric: true },
  { label: "Last seen" },
  { label: "Latest run" },
] as const satisfies readonly AutopilotHealthColumn[];

export const AUTOPILOT_HEALTH_WORKSPACE_COLUMNS = [
  { label: "Workspace" },
  { label: "Setup" },
  { label: "Templates", numeric: true },
  { label: "Runs", numeric: true },
  { label: "Failed", numeric: true },
  { label: "Last run" },
  { label: "Waiting", numeric: true },
  { label: "Merged", numeric: true },
] as const satisfies readonly AutopilotHealthColumn[];

export const AUTOPILOT_HEALTH_WORKFLOW_COLUMNS = [
  { label: "Workflow" },
  { label: "Runs", numeric: true },
  { label: "Failed", numeric: true },
  { label: "Last run" },
  { label: "Last error" },
] as const satisfies readonly AutopilotHealthColumn[];

/**
 * `workflow_key` of a run that runs every template. Mirrors the dashboard's
 * AUTOPILOT_DAILY_WORKFLOW_KEY; runs from before the key existed have none.
 */
export const AUTOPILOT_FULL_RUN_WORKFLOW_KEY = "autopilot.daily";
