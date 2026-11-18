import { AUTOPILOT_DEFAULT_JOBS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import { autopilotRuns, autopilotSettings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { AUTOPILOT_NO_CREDITS_MESSAGE } from "@/constants/autopilot";
import {
  AUTOPILOT_DAILY_WORKFLOW_KEY,
  AUTOPILOT_TEMPLATE_WORKFLOW_KEYS,
} from "@/constants/workflow-engine";
import { resolveAutopilotCredits } from "@/lib/autopilot/credits";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { claimAutopilotRun } from "@/lib/autopilot/run";
import { runTransition } from "@/lib/autopilot/transitions";
import { startWorkflowRun } from "@/lib/workflow-engine/start";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { AutopilotRunTrigger } from "@/types/autopilot-runtime";

export async function startAutopilot(
  organizationId: string,
  trigger: AutopilotRunTrigger,
  kind?: AutopilotAutomationKind
): Promise<{ runId: string; alreadyRunning: boolean }> {
  // Every run starts here, so a workspace without the flag never runs one.
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    throw new Error("Autopilot is not available for this workspace");
  }
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { lastRunAt: true, enabled: true, jobs: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  if (!settings?.enabled) {
    throw new Error("Turn on Autopilot before running it.");
  }
  const jobs = { ...AUTOPILOT_DEFAULT_JOBS, ...settings.jobs };
  if (kind && !jobs[kind]) {
    throw new Error("Turn this automation on before running it.");
  }
  // The scheduler checks credits itself and records a skipped run instead.
  if (
    trigger !== "cron" &&
    (await resolveAutopilotCredits(organizationId)) === "exhausted"
  ) {
    throw new Error(AUTOPILOT_NO_CREDITS_MESSAGE);
  }
  const workflowKey = kind
    ? AUTOPILOT_TEMPLATE_WORKFLOW_KEYS[kind]
    : AUTOPILOT_DAILY_WORKFLOW_KEY;
  const claim = await claimAutopilotRun(organizationId, trigger, workflowKey);
  if (claim.alreadyRunning) {
    return claim;
  }
  try {
    await startWorkflowRun({
      runId: claim.runId,
      organizationId,
      workflowKey,
      trigger,
      input: {
        autopilotRunId: claim.runId,
        previousRunAt: settings.lastRunAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    await db
      .update(autopilotRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(
        and(
          eq(autopilotRuns.id, claim.runId),
          eq(autopilotRuns.organizationId, organizationId),
          runTransition("failed")
        )
      );
    throw error;
  }
  return claim;
}
