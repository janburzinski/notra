import {
  type GeoFailureWire,
  toGeoFailureWire,
} from "@notra/geo-core/geo/failure-wire";
import { remoteGeoFailureBodySchema } from "@notra/schemas/api/internal-geo";
import { Effect } from "effect";

import { geoCoreApiLayer } from "../lib/geo/configure";
import type {
  GeoApiRuntime,
  GeoFailure,
  GeoOutcome,
  GeoProgramError,
  RemoteGeoEffectOptions,
} from "../types/geo";
import {
  callDashboardInternal,
  InternalDashboardError,
  InternalDashboardTimeoutError,
} from "../utils/internal-workflow";
import { logError } from "../utils/logging";

function toGeoFailure(failure: GeoFailureWire): GeoFailure {
  switch (failure._tag) {
    case "GeoSuggestionNotFoundError":
      return { status: 404, error: "Suggestion not found" };
    case "GeoProjectNotFoundError":
      return { status: 404, error: "Project not found" };
    case "GeoProjectDeleteBlockedError":
      return {
        status: 409,
        error:
          failure.reason === "has_sites"
            ? "This project has hosted sites. Delete its sites before deleting the project."
            : "Cannot delete the organization's last project. Create another project first.",
      };
    case "GeoPromptNotFoundError":
      return { status: 404, error: "Prompt not found" };
    case "GeoSequenceNotFoundError":
      return { status: 404, error: "Sequence not found" };
    case "GeoContentBriefNotFoundError":
      return { status: 404, error: "Content brief not found" };
    case "GeoBrandIdentityNotFoundError":
      return { status: 404, error: "Brand identity not found" };
    case "GeoBrandIdentityMissingError":
      return {
        status: 400,
        error: "Create a brand identity before creating a project",
      };
    case "GeoSettingsMissingError":
      return {
        status: 404,
        error: "GEO settings are not configured for this project",
      };
    case "GeoSettingsDisabledError":
      return {
        status: 400,
        error: "Enable brand tracking before starting a scan",
      };
    case "GeoPromptDuplicateError":
      return { status: 409, error: "That prompt is already tracked" };
    case "GeoScanAlreadyRunningError":
      return {
        status: 409,
        error: "A scan is already running for this project",
      };
    case "GeoScanEnginesEmptyError":
      return {
        status: 400,
        error: "Select at least one available model to scan",
      };
    case "GeoCompetitorLimitError":
      return {
        status: 400,
        error:
          failure.limit === undefined
            ? "Too many competitors."
            : `Too many competitors. The limit is ${failure.limit}.`,
      };
    case "GeoSequenceRunUnavailableError":
      return {
        status: 400,
        error: "No engine is available for this project's retention policy",
      };
    case "GeoSequenceLimitError":
      return {
        status: 400,
        error: `You can have up to ${failure.limit} conversations. Remove one before adding another.`,
      };
    case "GeoWriterCreditsExhaustedError":
      return {
        status: 402,
        error: failure.message ?? "AI credits are exhausted",
      };
    case "GeoContentBriefStateError":
      return {
        status: 409,
        error: `Content brief is ${failure.status ?? "in another state"} and cannot be changed`,
      };
    case "GeoDiscoveryError":
    case "GeoSequenceRunError":
    case "GeoSettingsTrackingError":
    case "GeoWriterPlanError":
      return { status: 400, error: failure.message ?? "Invalid request" };
    case "GeoSampleDataDisabledError":
      return { status: 400, error: "Sample data is disabled" };
    case "GeoProjectCreateFailedError":
      return { status: 500, error: "Failed to create the project" };
    case "GeoSequenceCreateFailedError":
      return { status: 500, error: "Failed to create the sequence" };
    case "GeoScanStartError":
      return { status: 500, error: "Failed to start the scan" };
    case "GeoWriterStartError":
      return { status: 500, error: "Failed to start the writer" };
    default:
      return { status: 500, error: "Internal server error" };
  }
}

function toGeoProgramFailure(error: GeoProgramError): GeoFailure {
  switch (error._tag) {
    case "GeoSelectionInvalidError":
      return { status: 400, error: error.message };
    case "AgentReadinessTargetMissingError":
    case "AgentReadinessApiError":
      return { status: 400, error: error.message };
    case "GeoScanNotFoundError":
      return { status: 404, error: "Scan not found" };
    case "AgentReadinessClaimError":
    case "AgentReadinessStampError":
    case "AgentReadinessStartError":
      return { status: 500, error: "Internal server error" };
    default:
      return toGeoFailure(toGeoFailureWire(error));
  }
}

export async function runGeoEffect<A, E extends GeoProgramError>(
  label: string,
  effect: Effect.Effect<A, E, GeoApiRuntime>
): Promise<GeoOutcome<A>> {
  try {
    const outcome = await Effect.runPromise(
      Effect.result(Effect.provide(effect, geoCoreApiLayer))
    );

    if (outcome._tag === "Failure") {
      const failure = toGeoProgramFailure(outcome.failure);
      if (failure.status === 500) {
        logError(`[GEO] ${label}`, outcome.failure);
      }
      return { ok: false, failure };
    }

    return { ok: true, value: outcome.success };
  } catch (error) {
    logError(`[GEO] ${label} (defect)`, error);
    return {
      ok: false,
      failure: { status: 500, error: "Internal server error" },
    };
  }
}

function readRemoteFailure(detail: string): GeoFailureWire | null {
  try {
    const parsed = remoteGeoFailureBodySchema.safeParse(JSON.parse(detail));
    return parsed.success ? parsed.data.failure : null;
  } catch {
    return null;
  }
}

export async function runRemoteGeoEffect<A>(
  label: string,
  url: string,
  payload: unknown,
  options: RemoteGeoEffectOptions<A>
): Promise<GeoOutcome<A>> {
  try {
    return {
      ok: true,
      value: await callDashboardInternal(
        url,
        payload,
        options.responseSchema,
        options.timeoutMs
      ),
    };
  } catch (error) {
    if (error instanceof InternalDashboardTimeoutError) {
      logError(`[GEO] ${label} (remote timeout)`, error);
      return {
        ok: false,
        failure: {
          status: 409,
          error: options.timeoutMessage,
        },
      };
    }

    const remote =
      error instanceof InternalDashboardError
        ? readRemoteFailure(error.body)
        : null;
    if (remote) {
      const failure = toGeoFailure(remote);
      if (failure.status === 500) {
        logError(`[GEO] ${label} (remote)`, error);
      }
      return { ok: false, failure };
    }

    logError(`[GEO] ${label} (remote)`, error);
    return {
      ok: false,
      failure: { status: 500, error: "Internal server error" },
    };
  }
}
