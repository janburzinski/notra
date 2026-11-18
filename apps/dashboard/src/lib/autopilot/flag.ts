import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_KEY,
  AUTOPILOT_FLAG_TIMEOUT_MS,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { resolveAutopilotEntitlement } from "@/lib/billing/autopilot-entitlement";
import { resolveGeoFlagState } from "@/lib/geo/flag";
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

export function isAutopilotWorkflowGraphEnabled(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY, organizationId);
}
