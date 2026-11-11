import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_KEY,
  AUTOPILOT_FLAG_TIMEOUT_MS,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { resolveGeoFlagState } from "@/lib/geo/flag";
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

export function autopilotFlagState(organizationId: string) {
  return flagState(AUTOPILOT_FLAG_KEY, organizationId);
}

export function isAutopilotEnabledForOrganization(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_FLAG_KEY, organizationId);
}

export function isAutopilotWorkflowGraphEnabled(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY, organizationId);
}
