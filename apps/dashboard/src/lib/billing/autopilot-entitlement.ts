import {
  allowUnmeteredAiInDevelopment,
  autumn,
  AUTUMN_READ_TIMEOUT_MS,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { Cache, Duration, Effect, Exit } from "effect";

import { AutopilotEntitlementError } from "@/lib/autopilot/errors";
import type { GeoFlagState } from "@/types/geo";

const GRANTED_ACCESS_TTL = Duration.minutes(1);
const GRANTED_ACCESS_CACHE_CAPACITY = 10_000;

// Only grants are cached, so an upgrade takes effect on the next check.
const autopilotEntitlementCache = Effect.runSync(
  Cache.makeWith(
    (organizationId: string) =>
      Effect.tryPromise({
        try: async () => {
          const data = await autumn?.check(
            { customerId: organizationId, featureId: FEATURES.AUTOPILOT },
            { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
          );
          return data?.allowed === true;
        },
        catch: (cause) =>
          new AutopilotEntitlementError({
            message: "Failed to check the Autopilot plan feature",
            organizationId,
            cause,
          }),
      }),
    {
      capacity: GRANTED_ACCESS_CACHE_CAPACITY,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value ? GRANTED_ACCESS_TTL : Duration.zero,
    }
  )
);

/**
 * Whether the workspace's plan includes the `autopilot` feature. Without
 * Autumn only non-production environments count as entitled; a billing outage
 * answers `unavailable` so callers can tell it apart from a denial.
 */
export async function autopilotAccessState(
  organizationId: string
): Promise<GeoFlagState> {
  if (allowUnmeteredAiInDevelopment) {
    return "enabled";
  }
  if (!autumn) {
    return process.env.NODE_ENV === "production" ? "disabled" : "enabled";
  }
  try {
    const allowed = await Effect.runPromise(
      Cache.get(autopilotEntitlementCache, organizationId)
    );
    return allowed ? "enabled" : "disabled";
  } catch {
    return "unavailable";
  }
}

export async function isAutopilotEnabledForOrganization(
  organizationId: string
) {
  return (await autopilotAccessState(organizationId)) === "enabled";
}

/**
 * For work already underway, only a definite denial stops it. New runs and
 * reads use `isAutopilotEnabledForOrganization`, which fails closed.
 */
export async function isAutopilotOffForOrganization(organizationId: string) {
  return (await autopilotAccessState(organizationId)) === "disabled";
}
