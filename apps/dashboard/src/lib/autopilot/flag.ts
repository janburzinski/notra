import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_KEY,
  AUTOPILOT_FLAG_TIMEOUT_MS,
} from "@/constants/autopilot";
import { resolveGeoFlagState } from "@/lib/geo/flag";

export function isAutopilotEnabledForOrganization(
  organizationId: string
): Promise<boolean> {
  if (process.env.NODE_ENV === "development") {
    return Promise.resolve(true);
  }
  return Effect.runPromise(
    resolveGeoFlagState(AUTOPILOT_FLAG_KEY, organizationId).pipe(
      Effect.timeout(AUTOPILOT_FLAG_TIMEOUT_MS),
      Effect.map((state) => state === "enabled")
    )
  ).catch(() => false);
}
