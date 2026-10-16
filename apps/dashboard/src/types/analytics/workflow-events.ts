import type { PostHogProperties } from "@notra/posthog/types/posthog";

import type {
  WORKFLOW_ANALYTICS_NAMES,
  WORKFLOW_FAILURE_CLASSIFICATIONS,
  WORKFLOW_OUTCOMES,
  WORKFLOW_TRIGGERS,
} from "@/constants/workflow-analytics";

export type WorkflowAnalyticsName =
  (typeof WORKFLOW_ANALYTICS_NAMES)[keyof typeof WORKFLOW_ANALYTICS_NAMES];

export type WorkflowTrigger =
  (typeof WORKFLOW_TRIGGERS)[keyof typeof WORKFLOW_TRIGGERS];

export type WorkflowOutcome =
  (typeof WORKFLOW_OUTCOMES)[keyof typeof WORKFLOW_OUTCOMES];

export type WorkflowFailureClassification =
  (typeof WORKFLOW_FAILURE_CLASSIFICATIONS)[keyof typeof WORKFLOW_FAILURE_CLASSIFICATIONS];

/** Booleans and counts only, so diagnostics can never carry user content. */
export type WorkflowFailureDiagnostics = Record<string, boolean | number>;

export interface WorkflowFailureDetail {
  reason?: string;
  errorCode?: string;
  phase?: string;
  classification?: WorkflowFailureClassification;
  diagnostics?: WorkflowFailureDiagnostics;
}

export interface WorkflowStartedInput {
  workflow: WorkflowAnalyticsName;
  runId: string;
  organizationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  trigger?: string;
  properties?: PostHogProperties;
}

export interface WorkflowOutcomeInput extends WorkflowFailureDetail {
  websiteUrl?: string;
  workflow: WorkflowAnalyticsName;
  outcome: WorkflowOutcome;
  organizationId?: string | null;
  projectId?: string | null;
  runId?: string;
  startedAt?: number;
  stepFailed?: string;
  properties?: PostHogProperties;
}

export interface WorkflowLifecycleFields {
  workflow?: WorkflowAnalyticsName;
  startedAt?: number;
}

export interface StepErrorContext {
  workflow: WorkflowAnalyticsName;
  step: string;
  organizationId?: string | null;
}

export interface OnboardingAgentStartedInput {
  organizationId: string;
  runId?: string;
}
