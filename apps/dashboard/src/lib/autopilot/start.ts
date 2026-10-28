import { db } from "@notra/db/drizzle";
import { autopilotRuns, autopilotSettings } from "@notra/db/schema";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import { and, eq } from "drizzle-orm";

import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { claimAutopilotRun } from "@/lib/autopilot/run";
import { startAutopilotWorkflowRun } from "@/lib/workflows/start";
import type { AutopilotRunTrigger } from "@/types/autopilot-runtime";

export async function startAutopilot(
  organizationId: string,
  trigger: AutopilotRunTrigger,
  kind?: AutopilotJobKind
): Promise<{ runId: string; alreadyRunning: boolean }> {
  // Every run starts here, so a workspace without the flag never runs one.
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    throw new Error("Autopilot is not available for this workspace");
  }
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { lastRunAt: true, enabled: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  if (!settings?.enabled) {
    throw new Error("Turn on Autopilot before running it.");
  }
  const claim = await claimAutopilotRun(organizationId, trigger);
  if (claim.alreadyRunning) {
    return claim;
  }
  try {
    await startAutopilotWorkflowRun({
      organizationId,
      runId: claim.runId,
      kind,
      previousRunAt: kind ? null : (settings.lastRunAt?.toISOString() ?? null),
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
          eq(autopilotRuns.status, "running")
        )
      );
    throw error;
  }
  return claim;
}
