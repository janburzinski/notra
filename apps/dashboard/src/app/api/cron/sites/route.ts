import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { sweepSiteJobs } from "@/lib/sites/dispatch";
import { recheckSiteDomains } from "@/lib/sites/domain-recheck";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  const [jobs, domains] = await Promise.all([
    sweepSiteJobs(),
    recheckSiteDomains().catch((error: unknown) => {
      console.warn("sites.domain_recheck_sweep_failed", {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }),
  ]);
  return Response.json({ ...jobs, domains });
}
