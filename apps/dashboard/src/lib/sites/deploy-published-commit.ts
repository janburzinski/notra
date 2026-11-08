import { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";
import { deployBranchHead } from "@notra/sites-server/deploy";
import type { Site } from "@notra/sites-server/types/sites";

import { afterResponse } from "@/lib/framework/after-response";
import { dispatchSiteJobs } from "@/lib/sites/dispatch";

/** Queues the production build of a just-published commit; true when it couldn't be queued yet. */
export async function deployPublishedCommit(
  site: Site,
  commitSha: string,
  userId: string | null
): Promise<boolean> {
  try {
    const jobId = await deployBranchHead(site, {
      trigger: "manual",
      userId,
      commitSha,
    });
    afterResponse(() => dispatchSiteJobs([jobId]));
    return false;
  } catch {
    getOpenRequestLogger()?.set({
      sitesPublish: { siteId: site.id, commitSha, deployPending: true },
    });
    return true;
  }
}
