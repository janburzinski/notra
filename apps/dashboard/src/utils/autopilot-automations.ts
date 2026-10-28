import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";

import { AUTOPILOT_AUTOMATION_KINDS } from "@/constants/autopilot";
import { AUTOPILOT_AUTOMATION_SLUGS } from "@/constants/autopilot-ui";
import type { AutopilotRunView } from "@/types/autopilot";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

/** Only one full or single-automation run may be in flight per workspace. */
export function isScheduledRunInProgress(runs: AutopilotRunView[]) {
  return runs.some(
    (run) =>
      run.status === "running" &&
      (AUTOPILOT_SCHEDULED_TRIGGERS as readonly string[]).includes(run.trigger)
  );
}

export function automationKindFromSlug(
  slug: string
): AutopilotAutomationKind | null {
  return (
    AUTOPILOT_AUTOMATION_KINDS.find(
      (kind) => AUTOPILOT_AUTOMATION_SLUGS[kind] === slug
    ) ?? null
  );
}
