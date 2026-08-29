import { flushGeoLog } from "@notra/ai/evlog";
import { Effect } from "effect";
import { FatalError } from "workflow";

import { runGeoScan } from "@/lib/geo/scan";
import type { GeoScanResult, GeoScanRunResult } from "@/types/geo";

export async function runGeoScanStep(
  organizationId: string,
  projectId?: string
): Promise<GeoScanRunResult> {
  "use step";
  try {
    return await Effect.runPromise(
      runGeoScan(organizationId, projectId ? [projectId] : undefined)
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
      runGeoScan(organizationId, projectIds)
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
