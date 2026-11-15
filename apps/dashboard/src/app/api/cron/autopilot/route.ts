import { AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS } from "@/constants/autopilot";
import { cleanupCodeStorageRepos } from "@/lib/artifacts/repo-deletions";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { cleanupAutopilotNamespaces } from "@/lib/autopilot/namespace-deletions";
import { runDueAutopilots } from "@/lib/autopilot/schedule";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // One budget for every code.storage deletion, leaving time for daily runs.
  const now = new Date();
  const signal = AbortSignal.timeout(AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS);
  const [cleanup, repoCleanup, result] = await Promise.all([
    cleanupAutopilotNamespaces(now, signal),
    cleanupCodeStorageRepos(now, signal),
    runDueAutopilots(),
  ]);
  return Response.json(
    { ...result, cleanup, repoCleanup },
    {
      status:
        result.failed > 0 || cleanup.failed > 0 || repoCleanup.failed > 0
          ? 500
          : 200,
    }
  );
}
