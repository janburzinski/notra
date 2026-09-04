import { geoProjectSetupWorkflowPayloadSchema } from "@notra/geo-core/schemas/geo";
import type { GeoProjectSetupWorkflowPayload } from "@notra/geo-core/types/geo";

import type { GeoProjectSetupWorkflowResult } from "@/types/workflows/geo-project-setup";

import {
  isGeoProjectSetupAttemptActiveStep,
  markGeoProjectSetupFailed,
  markGeoProjectSetupReady,
  runGeoProjectSetupStep,
  startFirstAgentReadinessScanStep,
  startInitialGeoScanStep,
} from "./steps/geo-project-setup-steps";

export async function geoProjectSetupWorkflow(
  payload: GeoProjectSetupWorkflowPayload
): Promise<GeoProjectSetupWorkflowResult> {
  "use workflow";

  const parsed = geoProjectSetupWorkflowPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[GEO] Invalid project setup workflow payload");
    return { status: "invalid_payload" };
  }

  try {
    if (!(await isGeoProjectSetupAttemptActiveStep(parsed.data))) {
      return { status: "superseded" };
    }
    await startFirstAgentReadinessScanStep(parsed.data);
    if (!(await runGeoProjectSetupStep(parsed.data))) {
      return { status: "superseded" };
    }
    if (!(await startInitialGeoScanStep(parsed.data))) {
      return { status: "superseded" };
    }
    await markGeoProjectSetupReady(parsed.data);
    return { status: "completed" };
  } catch (error) {
    await markGeoProjectSetupFailed(parsed.data);
    throw error;
  }
}
