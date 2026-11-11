import type { AnalyticsImportRunState } from "@/types/analytics-imports";

/**
 * Where an import's workflow run stands. The workflow runtime is only loaded
 * when a run is actually inspected.
 */
export async function readImportRunState(
  runId: string
): Promise<AnalyticsImportRunState> {
  const { getRun } = await import("workflow/api");
  const run = getRun(runId);
  if (!(await run.exists)) {
    return "missing";
  }
  return await run.status;
}

/** Ends a queued import's wait early, so it starts right after the one before it. */
export async function wakeImportRun(runId: string): Promise<void> {
  const { getRun } = await import("workflow/api");
  await getRun(runId).wakeUp();
}

/** Stops a run recovery replaced; the new run's generation fences it anyway. */
export async function cancelImportRun(runId: string): Promise<void> {
  const { getRun } = await import("workflow/api");
  await getRun(runId).cancel();
}
