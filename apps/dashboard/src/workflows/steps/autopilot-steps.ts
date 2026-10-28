import "@/workflows/runtime";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";

import { closeStalePullRequests } from "@/lib/autopilot/cleanup";
import {
  buildAutopilotRunContext,
  deliverAutopilotBrief,
  finishAutopilotRun,
  planAutopilot,
  runAutopilotJob,
} from "@/lib/autopilot/run";
import type {
  AutopilotJobResult,
  AutopilotRunObservation,
} from "@/types/autopilot";

export async function closeStalePullRequestsStep(
  organizationId: string,
  runId: string
): Promise<number> {
  "use step";
  const ctx = await buildAutopilotRunContext(organizationId, runId);
  return closeStalePullRequests(ctx);
}

export async function runAutopilotJobStep(
  organizationId: string,
  runId: string,
  kind: AutopilotJobKind
): Promise<AutopilotJobResult> {
  "use step";
  const ctx = await buildAutopilotRunContext(organizationId, runId);
  return runAutopilotJob(ctx, kind);
}

export async function planAutopilotStep(
  organizationId: string,
  runId: string,
  observations: AutopilotRunObservation[]
): Promise<AutopilotJobResult> {
  "use step";
  const ctx = await buildAutopilotRunContext(organizationId, runId);
  return planAutopilot(ctx, observations);
}

export async function deliverAutopilotBriefStep(
  organizationId: string,
  runId: string,
  results: AutopilotJobResult[],
  previousRunAt: string | null
): Promise<string | null> {
  "use step";
  const ctx = await buildAutopilotRunContext(organizationId, runId);
  return deliverAutopilotBrief({
    ctx,
    results,
    previousRunAt: previousRunAt ? new Date(previousRunAt) : null,
  });
}

export async function finishAutopilotRunStep(params: {
  organizationId: string;
  runId: string;
  results: AutopilotJobResult[];
  slackMessageTs: string | null;
  error?: string;
  scheduled?: boolean;
}): Promise<void> {
  "use step";
  await finishAutopilotRun(params);
}
