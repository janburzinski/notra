import { flushGeoLog } from "@notra/ai/evlog";
import { retryGeoScan, runGeoScan } from "@notra/geo-core/geo/scan";
import type {
  GeoScanResult,
  GeoScanRunResult,
} from "@notra/geo-core/types/geo";
import { Effect } from "effect";
import { FatalError } from "workflow";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";

/**
 * `claimedAt` arrives as an ISO string because workflow payloads are JSON.
 * A value that does not parse is dropped rather than passed on: a bogus token
 * would fail every compare-and-set and silently disable the claim hand-back.
 */
function parseClaimedAt(claimedAt?: string): Date | undefined {
  if (!claimedAt) {
    return;
  }
  const parsed = new Date(claimedAt);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function runGeoScanStep(
  organizationId: string,
  projectId?: string,
  claimedAt?: string,
  scanId?: string
): Promise<GeoScanRunResult> {
  "use step";
  try {
    return await Effect.runPromise(
      runGeoScan(
        organizationId,
        projectId,
        parseClaimedAt(claimedAt),
        scanId
      ).pipe(Effect.provide(geoCoreDashboardLayer))
    );
  } finally {
    await flushGeoLog();
  }
}

export async function retryGeoScanStep(
  organizationId: string,
  projectIds: string[],
  hadSuccessfulChecks: boolean
): Promise<GeoScanResult> {
  "use step";
  try {
    const result = await Effect.runPromise(
      retryGeoScan(organizationId, projectIds).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    );
    if (result.status === "retry_no_successful_checks") {
      if (!hadSuccessfulChecks && result.checks === 0) {
        const message = `GEO scan retry produced no successful checks for ${result.retryProjectIds.length} projects`;
        console.error(`[GEO] ${message}`);
        throw new FatalError(message);
      }
      return {
        status: "completed",
        checks: result.checks,
        mentions: result.mentions,
      };
    }
    return result;
  } finally {
    await flushGeoLog();
  }
}
