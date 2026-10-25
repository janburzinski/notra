import { AUTOPILOT_JOB_KINDS } from "@notra/db/constants/autopilot";

import type {
  AutopilotJobResult,
  AutopilotWorkflowPayload,
  AutopilotWorkflowResult,
} from "@/types/autopilot";

import {
  closeStalePullRequestsStep,
  deliverAutopilotBriefStep,
  finishAutopilotRunStep,
  planAutopilotStep,
  runAutopilotJobStep,
} from "./steps/autopilot-steps";

export async function autopilotWorkflow(
  payload: AutopilotWorkflowPayload & { previousRunAt: string | null }
): Promise<AutopilotWorkflowResult> {
  "use workflow";

  const { organizationId, runId, previousRunAt } = payload;
  const results: AutopilotJobResult[] = [];
  try {
    // First, so closed drafts free up the open pull request limit for today.
    await closeStalePullRequestsStep(organizationId, runId);
    for (const kind of AUTOPILOT_JOB_KINDS) {
      results.push(await runAutopilotJobStep(organizationId, runId, kind));
    }
    // Keywords and commits only observe; one planning step links and acts.
    results.push(
      await planAutopilotStep(
        organizationId,
        runId,
        results.flatMap((result) => result.observations ?? [])
      )
    );
    const slackMessageTs = await deliverAutopilotBriefStep(
      organizationId,
      runId,
      results,
      previousRunAt
    );
    await finishAutopilotRunStep({
      organizationId,
      runId,
      results,
      slackMessageTs,
    });
    return {
      status: "completed",
      runId,
      findings: results.flatMap((result) => result.findingIds).length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishAutopilotRunStep({
      organizationId,
      runId,
      results,
      slackMessageTs: null,
      error: message,
    });
    return { status: "failed", runId, error: message };
  }
}
