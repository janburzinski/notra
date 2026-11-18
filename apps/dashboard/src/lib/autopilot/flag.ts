import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_KEY,
  AUTOPILOT_FLAG_TIMEOUT_MS,
  AUTOPILOT_ONBOARDING_RESET_FLAG_KEY,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { resolveAutopilotEntitlement } from "@/lib/billing/autopilot-entitlement";
import { getFlagsManager, resolveGeoFlagState } from "@/lib/geo/flag";
import type { AutopilotAvailability } from "@/types/autopilot-runtime";
import type { GeoFlagState } from "@/types/geo";

function flagState(
  flagKey: string,
  organizationId: string
): Promise<GeoFlagState> {
  if (process.env.NODE_ENV === "development") {
    return Promise.resolve("enabled");
  }
  return Effect.runPromise(
    resolveGeoFlagState(flagKey, organizationId).pipe(
      Effect.timeout(AUTOPILOT_FLAG_TIMEOUT_MS)
    )
  ).catch((): GeoFlagState => "unavailable");
}

async function isFlagEnabled(flagKey: string, organizationId: string) {
  return (await flagState(flagKey, organizationId)) === "enabled";
}

/**
 * Autopilot needs both the `autopilot` rollout flag and the `autopilot`
 * feature on the workspace's Autumn plan. The plan is only checked once the
 * flag is on, so workspaces outside the rollout never reach billing, and only
 * those inside it are asked to upgrade.
 */
export async function resolveAutopilotAvailability(
  organizationId: string
): Promise<AutopilotAvailability> {
  const flag = await flagState(AUTOPILOT_FLAG_KEY, organizationId);
  if (flag !== "enabled") {
    return flag;
  }
  const plan = await resolveAutopilotEntitlement(organizationId);
  return plan === "disabled" ? "upgrade_required" : plan;
}

export async function autopilotAccessState(
  organizationId: string
): Promise<GeoFlagState> {
  const availability = await resolveAutopilotAvailability(organizationId);
  return availability === "upgrade_required" ? "disabled" : availability;
}

export async function isAutopilotEnabledForOrganization(
  organizationId: string
) {
  return (await autopilotAccessState(organizationId)) === "enabled";
}

/**
 * For work already under way, such as a webhook or a Slack vote: only a
 * definite no stops it, so a billing or flag outage doesn't silently drop
 * something that can't be delivered again. New runs and reads use
 * `isAutopilotEnabledForOrganization`, which fails closed.
 */
export async function isAutopilotOffForOrganization(organizationId: string) {
  return (await autopilotAccessState(organizationId)) === "disabled";
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

export function isAutopilotWorkflowGraphEnabled(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY, organizationId);
}
