import { queueToolchainRebuilds } from "@notra/sites-server/toolchain-rebuilds";

import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import type { SiteToolchainRebuildResult } from "@/types/sites-server";

/**
 * Rebuilds live sites that an older builder built, a few per run, once the
 * release that changed rendering is live.
 */
export async function rebuildOutdatedSites(): Promise<SiteToolchainRebuildResult> {
  const { queued } = await queueToolchainRebuilds();
  await dispatchSiteJobs(queued.map((rebuild) => rebuild.jobId));
  return { queued: queued.length };
}
