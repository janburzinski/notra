import type {
  AutopilotFindingStatus,
  AutopilotRunStatus,
} from "@notra/db/types/autopilot";

import type { StatusTransitions } from "@/types/status-transition";

export const AUTOPILOT_FINDING_TRANSITIONS = {
  suggested: ["open", "dismissed", "expired"],
  open: ["open", "proposed", "suggested", "dismissed", "failed"],
  proposed: ["merged", "dismissed", "expired"],
  merged: [],
  dismissed: ["open"],
  expired: ["open", "proposed", "merged", "dismissed"],
  failed: ["open", "dismissed"],
} as const satisfies StatusTransitions<AutopilotFindingStatus>;

export const AUTOPILOT_RUN_TRANSITIONS = {
  running: ["completed", "failed", "stopped"],
  completed: [],
  failed: [],
  stopped: [],
  skipped: [],
} as const satisfies StatusTransitions<AutopilotRunStatus>;
