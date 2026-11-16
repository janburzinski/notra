import { AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS } from "@/constants/autopilot";
import { cleanupCodeStorageRepos } from "@/lib/artifacts/repo-deletions";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { compactAutopilotMemory } from "@/lib/autopilot/memory-history";
import { cleanupAutopilotNamespaces } from "@/lib/autopilot/namespace-deletions";
import { runDueAutopilots } from "@/lib/autopilot/schedule";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // One budget for all code.storage upkeep, leaving time for daily runs.
  const now = new Date();
  const signal = AbortSignal.timeout(AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS);
  const [cleanup, repoCleanup, memoryHistory, result] = await Promise.all([
    cleanupAutopilotNamespaces(now, signal),
    cleanupCodeStorageRepos(now, signal),
    compactAutopilotMemory(now, signal),
    runDueAutopilots(),
  ]);
  const failed =
    result.failed + cleanup.failed + repoCleanup.failed + memoryHistory.failed;
  return Response.json(
    { ...result, cleanup, repoCleanup, memoryHistory },
    { status: failed > 0 ? 500 : 200 }
  );
}
