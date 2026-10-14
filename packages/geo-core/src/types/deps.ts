import type { ContentBillingReservation } from "@notra/ai/types/billing";
import type {
  GscIntegrationRow,
  GscQueryRow,
} from "@notra/ai/types/google-search-console";
import type { Effect } from "effect";

import type { GeoCodingAgentAccessError } from "../geo/errors";
import type { GeoSearchConsoleError } from "../schemas/search-console-errors";
import type { AgentReadinessWorkflowPayload } from "./agent-readiness";
import type {
  FinalizeContentBillingInput,
  GateContentBillingInput,
} from "./content-billing";
import type { ActiveGeneration } from "./generation-tracking";
import type { GeoZdrEntitlement, GeoWriterPayload } from "./geo";

export interface GeoSearchConsoleServiceShape {
  readonly topQueries: (
    integration: GscIntegrationRow,
    siteUrl: string
  ) => Effect.Effect<GscQueryRow[], GeoSearchConsoleError>;
}

export interface GeoWorkflowServiceShape {
  readonly startGeoScanRun: (payload: {
    organizationId: string;
    projectId?: string;
    claimedAt?: string;
    scanId?: string;
    promptIds?: string[];
    engines?: string[];
  }) => Effect.Effect<{ runId: string }, unknown>;
  readonly startGeoWriterRun: (
    payload: GeoWriterPayload
  ) => Effect.Effect<{ runId: string }, unknown>;
  readonly startAgentReadinessRun: (
    payload: AgentReadinessWorkflowPayload
  ) => Effect.Effect<{ runId: string }, unknown>;
}

export interface GeoContentBillingServiceShape {
  readonly gateContentBilling: (
    input: GateContentBillingInput
  ) => Effect.Effect<ContentBillingReservation, unknown>;
  readonly finalizeContentBilling: (
    input: FinalizeContentBillingInput
  ) => Effect.Effect<void, unknown>;
}

export interface GeoEntitlementServiceShape {
  readonly resolveZdrEntitlement: (
    organizationId: string
  ) => Effect.Effect<GeoZdrEntitlement>;
  /**
   * The scan billing gate's verdict without reserving anything, so a trigger
   * can refuse a scan the workflow would only deny later.
   */
  readonly checkScanBilling: (
    organizationId: string
  ) => Effect.Effect<ContentBillingReservation, unknown>;
}

export interface GeoCodingAgentAccessServiceShape {
  readonly hasPaidPlanForOrganization: (
    organizationId: string
  ) => Effect.Effect<boolean, GeoCodingAgentAccessError>;
}

export interface GeoGenerationServiceShape {
  readonly addActiveGeneration: (
    organizationId: string,
    generation: ActiveGeneration
  ) => Effect.Effect<void, unknown>;
  readonly generateRunId: (triggerId: string) => Effect.Effect<string>;
}
