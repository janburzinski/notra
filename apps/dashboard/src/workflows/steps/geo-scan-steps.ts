import { flushGeoLog } from "@notra/ai/evlog";
import { Effect } from "effect";
import { FatalError } from "workflow";

import { GeoNoSuccessfulChecksError } from "@/lib/geo/errors";
import { runGeoScan } from "@/lib/geo/scan";
import type { GeoScanResult, GeoScanStepResult } from "@/types/geo";

export async function runGeoScanStep(
  organizationId: string,
  projectId?: string
): Promise<GeoScanStepResult> {
  "use step";
  try {
    return await Effect.runPromise(runGeoScan(organizationId, projectId));
  } catch (error) {
    if (error instanceof GeoNoSuccessfulChecksError) {
      console.warn(
        `[GEO] No successful checks from ${error.attemptedChecks} attempts; scheduling one retry`
      );
      return { status: "retry_no_successful_checks" };
    }
    throw error;
  } finally {
    await flushGeoLog();
  }
}

export async function retryGeoScanStep(
  organizationId: string,
  projectId?: string
): Promise<GeoScanResult> {
  "use step";
  try {
    return await Effect.runPromise(runGeoScan(organizationId, projectId));
  } catch (error) {
    if (error instanceof GeoNoSuccessfulChecksError) {
      const message = `GEO scan retry produced no successful checks from ${error.attemptedChecks} attempts`;
      console.error(`[GEO] ${message}`);
      throw new FatalError(message);
    }
    throw error;
  } finally {
    await flushGeoLog();
  }
}
