import { startAgentReadinessScan } from "@notra/geo-core/geo/agent-readiness";
import { setupGeoProjectFromWebsite } from "@notra/geo-core/geo/discover";
import {
  isGeoProjectSetupAttemptActive,
  updateGeoProjectSetupStatus,
} from "@notra/geo-core/geo/projects";
import { startInitialGeoScanRun } from "@notra/geo-core/geo/scan-handoff";
import type { GeoProjectSetupWorkflowPayload } from "@notra/geo-core/types/geo";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";

export async function isGeoProjectSetupAttemptActiveStep(
  payload: GeoProjectSetupWorkflowPayload
): Promise<boolean> {
  "use step";
  return await Effect.runPromise(
    isGeoProjectSetupAttemptActive(
      payload.organizationId,
      payload.projectId,
      payload.setupAttemptId
    )
  );
}

export async function startFirstAgentReadinessScanStep(
  payload: GeoProjectSetupWorkflowPayload
): Promise<void> {
  "use step";
  await Effect.runPromise(
    startAgentReadinessScan(
      {
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        brandSettingsId: payload.brandSettingsId,
      },
      {
        reportId: payload.setupAttemptId,
        redispatchExisting: true,
      }
    )
      .pipe(Effect.provide(geoCoreDashboardLayer))
      .pipe(
        Effect.catchCause((cause) => {
          console.error(
            "[GEO] Failed to start the first agent readiness scan:",
            cause
          );
          return Effect.void;
        })
      )
  );
}

startFirstAgentReadinessScanStep.maxRetries = 0;

export async function runGeoProjectSetupStep(
  payload: GeoProjectSetupWorkflowPayload
): Promise<boolean> {
  "use step";
  return await Effect.runPromise(
    setupGeoProjectFromWebsite(payload).pipe(
      Effect.provide(geoCoreDashboardLayer)
    )
  );
}

runGeoProjectSetupStep.maxRetries = 0;

export async function startInitialGeoScanStep(
  payload: GeoProjectSetupWorkflowPayload
): Promise<boolean> {
  "use step";
  return await Effect.runPromise(
    startInitialGeoScanRun(
      payload.organizationId,
      payload.projectId,
      payload.setupAttemptId
    ).pipe(Effect.provide(geoCoreDashboardLayer))
  );
}

startInitialGeoScanStep.maxRetries = 0;

export async function markGeoProjectSetupReady(
  payload: GeoProjectSetupWorkflowPayload
): Promise<void> {
  "use step";
  await Effect.runPromise(
    updateGeoProjectSetupStatus(
      payload.organizationId,
      payload.projectId,
      "ready",
      null,
      payload.setupAttemptId
    )
  );
}

export async function markGeoProjectSetupFailed(
  payload: GeoProjectSetupWorkflowPayload
): Promise<void> {
  "use step";
  await Effect.runPromise(
    updateGeoProjectSetupStatus(
      payload.organizationId,
      payload.projectId,
      "failed",
      "Project setup failed",
      payload.setupAttemptId
    )
  );
}
