import { updateGeoProjectSetupStatus } from "@notra/geo-core/geo/projects";
import type {
  GeoProject,
  GeoProjectSetupDispatchPayload,
  GeoProjectSetupWorkflowPayload,
} from "@notra/geo-core/types/geo";
import { Effect } from "effect";

import { startGeoProjectSetupRun } from "@/lib/workflows/start";

export async function dispatchGeoProjectSetup(
  project: GeoProject,
  input: GeoProjectSetupDispatchPayload
): Promise<GeoProject> {
  const setupAttemptId = project.setupAttemptId;
  if (!setupAttemptId) {
    console.error("[GEO] Pending project has no setup attempt id");
    return await Effect.runPromise(
      updateGeoProjectSetupStatus(
        input.organizationId,
        input.projectId,
        "failed",
        "Project setup could not be started"
      )
    );
  }
  const payload: GeoProjectSetupWorkflowPayload = {
    ...input,
    setupAttemptId,
  };

  try {
    await startGeoProjectSetupRun(payload);
    return project;
  } catch (error) {
    console.error("[GEO] Failed to start project setup workflow:", error);
    // Workflow start failures are ambiguous: publication may have succeeded
    // before the response was lost. Keep the fenced attempt pending so that a
    // queued run can proceed; the stale lease exposes a safe retry otherwise.
    return project;
  }
}
