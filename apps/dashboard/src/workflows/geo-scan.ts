import { sleep } from "workflow";
import { flattenError } from "zod";

import { GEO_SCAN_NO_RESULTS_RETRY_DELAY } from "@/constants/geo";
import { geoOrganizationInputSchema } from "@/schemas/geo";
import type { GeoScanPayload, GeoScanResult } from "@/types/geo";

import {
  retryGeoScanStep,
  runGeoScanStep,
} from "./steps/geo-scan-steps";

export async function geoScanWorkflow(
  payload: GeoScanPayload
): Promise<GeoScanResult> {
  "use workflow";

  const parseResult = geoOrganizationInputSchema.safeParse(payload);
  if (!parseResult.success) {
    console.error("[GEO] Invalid payload:", flattenError(parseResult.error));
    return { status: "invalid_payload" };
  }

  const result = await runGeoScanStep(
    parseResult.data.organizationId,
    parseResult.data.projectId
  );
  if (result.status !== "retry_no_successful_checks") {
    return result;
  }

  await sleep(GEO_SCAN_NO_RESULTS_RETRY_DELAY);
  const retryResult = await retryGeoScanStep(
    parseResult.data.organizationId,
    result.retryProjectIds,
    result.checks > 0
  );
  return {
    status: "completed",
    checks: result.checks + (retryResult.checks ?? 0),
    mentions: result.mentions + (retryResult.mentions ?? 0),
  };
}
