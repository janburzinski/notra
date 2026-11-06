import { recheckDueSiteDomains } from "@notra/sites-server/domains";

import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import { notifyDomainConnected } from "@/lib/sites/info-channel";
import type { SiteDomainRecheckResult } from "@/types/sites-server";

/**
 * Checks domains that are not verified yet, so they go live without anyone
 * pressing "check". A newly verified domain rebuilds the site like a manual check.
 */
export async function recheckSiteDomains(): Promise<SiteDomainRecheckResult> {
  const rechecks = await recheckDueSiteDomains();
  await dispatchSiteJobs(
    rechecks.flatMap(({ result }) =>
      result.rebuildJobId ? [result.rebuildJobId] : []
    )
  );
  let verified = 0;
  for (const { site, result } of rechecks) {
    if (result.newlyVerified) {
      verified += 1;
      notifyDomainConnected(site, result.domain.hostname);
    }
  }
  return { checked: rechecks.length, verified };
}
