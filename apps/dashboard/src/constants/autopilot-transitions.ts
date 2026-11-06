import type {
  AutopilotFindingStatus,
  AutopilotRunStatus,
} from "@notra/db/types/autopilot";

import type { StatusTransitions } from "@/types/status-transition";

export const AUTOPILOT_FINDING_TRANSITIONS = {
  suggested: ["open", "dismissed"],
  open: ["open", "proposed", "suggested", "dismissed", "failed"],
  proposed: ["merged", "dismissed", "expired"],
  merged: [],
  dismissed: [],
  expired: ["open", "proposed", "merged", "dismissed"],
  failed: ["open", "dismissed"],
} as const satisfies StatusTransitions<AutopilotFindingStatus>;

export const AUTOPILOT_RUN_TRANSITIONS = {
  running: ["completed", "failed", "stopped"],
  completed: [],
  failed: [],
  stopped: [],
} as const satisfies StatusTransitions<AutopilotRunStatus>;
