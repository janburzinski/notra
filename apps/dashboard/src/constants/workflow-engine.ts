import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { StatusTransitions } from "@/types/status-transition";
import type { WorkflowRunStatus } from "@/types/workflow-engine";

export const WORKFLOW_NODE_MAX_RETRIES = 2;

export const WORKFLOW_STORED_PREVIEW_MAX_CHARS = 4000;

export const WORKFLOW_STORED_VALUE_MAX_CHARS = 32_000;

export const WORKFLOW_RUN_TRANSITIONS = {
  queued: ["running", "completed", "failed", "stopped"],
  running: ["completed", "failed", "stopped"],
  stopped: ["completed", "failed", "stopped"],
  completed: [],
  failed: [],
} as const satisfies StatusTransitions<WorkflowRunStatus>;

export const WORKFLOW_RUN_STOPPED_MESSAGE = "The run was stopped";

export const AUTOPILOT_DAILY_WORKFLOW_KEY = "autopilot.daily";

export const AUTOPILOT_CONTENT_WORKFLOW_KEY = "autopilot.content";

export const AUTOPILOT_TEMPLATE_WORKFLOW_KEYS = {
  readiness: "autopilot.readiness",
  keywords: "autopilot.content-gaps",
  commits: "autopilot.releases",
  refresh: "autopilot.refresh",
  comparisons: "autopilot.comparisons",
  rendering: "autopilot.rendering",
  links: "autopilot.links",
} as const satisfies Record<AutopilotAutomationKind, string>;
