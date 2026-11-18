import type { GeoScanEventStep } from "@notra/db/types/geo-scan";
import type { Effect } from "effect";

import { withGeoTiming } from "./geo-timing";

export function withGeoScanStep<A, E, R>(
  context: {
    organizationId: string;
    projectId: string;
    scanId: string;
    runId: string;
  },
  step: GeoScanEventStep,
  operation: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> {
  return withGeoTiming(operation, {
    event: `geo.scan.${step}.completed`,
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    runId: context.runId,
  });
}
