import { db } from "@notra/db/drizzle";
import { siteDeployments, sites } from "@notra/db/schema";
import { and, eq, ne } from "drizzle-orm";

import type {
  SiteDeployment,
  SiteStorageTransaction,
} from "./types/deployments";
import { supersedesLiveBuild } from "./utils/live-build";

/**
 * A theme rebuild only refreshes the build of the commit that is live: it is
 * stale once another commit went live or another production build is queued,
 * building or newer, whatever their generations.
 */
export async function isStaleToolchainRebuild(
  deployment: SiteDeployment,
  executor: Pick<SiteStorageTransaction, "select"> = db
): Promise<boolean> {
  const [live] = await executor
    .select({
      id: siteDeployments.id,
      commitSha: siteDeployments.commitSha,
      generation: siteDeployments.generation,
    })
    .from(sites)
    .innerJoin(
      siteDeployments,
      and(
        eq(siteDeployments.id, sites.activeProductionDeploymentId),
        eq(siteDeployments.siteId, sites.id)
      )
    )
    .where(eq(sites.id, deployment.siteId))
    .limit(1);
  if (!live || live.commitSha !== deployment.commitSha) {
    return true;
  }
  const [newer] = await executor
    .select({ id: siteDeployments.id })
    .from(siteDeployments)
    .where(
      and(
        supersedesLiveBuild(siteDeployments, {
          siteId: deployment.siteId,
          id: live.id,
          generation: live.generation,
        }),
        ne(siteDeployments.id, deployment.id)
      )
    )
    .limit(1);
  return Boolean(newer);
}
