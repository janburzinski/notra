import { autopilotFindings, autopilotRuns } from "@notra/db/schema";
import type { AutopilotFindingStatus } from "@notra/db/types/autopilot";

import {
  AUTOPILOT_FINDING_TRANSITIONS,
  AUTOPILOT_RUN_TRANSITIONS,
} from "@/constants/autopilot-transitions";
import { statusTransition } from "@/lib/db/status-transition";
import type { StatusSources } from "@/types/status-transition";

export function findingTransition<To extends AutopilotFindingStatus>(
  to: To,
  from: readonly Extract<
    StatusSources<typeof AUTOPILOT_FINDING_TRANSITIONS, To>,
    string
  >[]
) {
  return statusTransition(
    autopilotFindings.status,
    AUTOPILOT_FINDING_TRANSITIONS,
    to,
    from
  );
}

export function runTransition(
  to: (typeof AUTOPILOT_RUN_TRANSITIONS)["running"][number]
) {
  return statusTransition(autopilotRuns.status, AUTOPILOT_RUN_TRANSITIONS, to, [
    "running",
  ]);
}
