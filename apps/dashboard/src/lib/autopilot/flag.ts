import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_TIMEOUT_MS,
  AUTOPILOT_ONBOARDING_RESET_FLAG_KEY,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { getFlagsManager, resolveGeoFlagState } from "@/lib/geo/flag";

export async function isAutopilotWorkflowGraphEnabled(organizationId: string) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const state = await Effect.runPromise(
    resolveGeoFlagState(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY, organizationId).pipe(
      Effect.timeout(AUTOPILOT_FLAG_TIMEOUT_MS)
    )
  ).catch(() => "unavailable");
  return state === "enabled";
}

/**
 * The onboarding reset is for the people testing it, so the flag sees who
 * asks, not just the workspace: it can be turned on for one person.
 */
export async function canResetAutopilotOnboarding(
  organizationId: string,
  user: { id: string; email: string }
) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const manager = getFlagsManager();
  if (!manager || isDemoMode()) {
    return false;
  }
  try {
    const result = await Promise.race([
      manager.getFlag(AUTOPILOT_ONBOARDING_RESET_FLAG_KEY, {
        organizationId,
        userId: user.id,
        email: user.email,
        properties: { organizationId },
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), AUTOPILOT_FLAG_TIMEOUT_MS)
      ),
    ]);
    return result?.enabled === true;
  } catch {
    return false;
  }
}
