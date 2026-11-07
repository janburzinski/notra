import { db } from "@notra/db/drizzle";
import {
  githubAppInstallations,
  githubIntegrations,
  siteDeployments,
  siteJobDedupeKeys,
  siteJobs,
  sites,
} from "@notra/db/schema";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";
import {
  aliasedTable,
  and,
  asc,
  eq,
  exists,
  inArray,
  notExists,
  sql,
} from "drizzle-orm";

import {
  TOOLCHAIN_REBUILD_DEDUPE_PREFIX,
  TOOLCHAIN_REBUILD_LIMITS,
  TOOLCHAIN_REBUILD_LOCK,
} from "./constants/toolchain-rebuilds";
import { enqueueSiteDeployment } from "./deployments";
import { getSitesBuilderRenderFingerprint } from "./env";
import { SiteNotBuildableError } from "./errors/sites";
import type { SiteStorageTransaction } from "./types/deployments";
import type {
  QueuedToolchainRebuild,
  ToolchainRebuildOptions,
  ToolchainRebuildSweep,
} from "./types/toolchain-rebuilds";
import { toolchainRebuildInput } from "./utils/deployments";
import { errorMessage } from "./utils/errors";
import { supersedesLiveBuild } from "./utils/live-build";
import { repositoryApproval } from "./utils/repository-approval";

const inProgress = [...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES];

/** Automatic rebuilds use only idle builders, so pushes keep their capacity. */
async function freeSlots(tx: SiteStorageTransaction): Promise<number> {
  const [load] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      toolchain: sql<number>`count(*) filter (where ${siteDeployments.trigger} = 'toolchain')::int`,
    })
    .from(siteJobs)
    .innerJoin(siteDeployments, eq(siteDeployments.id, siteJobs.deploymentId))
    .where(
      and(
        eq(siteJobs.kind, "build"),
        inArray(siteJobs.status, ["pending", "running"]),
        inArray(siteDeployments.status, inProgress)
      )
    );
  return Math.min(
    TOOLCHAIN_REBUILD_LIMITS.maxInFlight - (load?.toolchain ?? 0),
    TOOLCHAIN_REBUILD_LIMITS.maxBusyBuilds - (load?.total ?? 0)
  );
}

/**
 * Live production builds made with another render fingerprint, on active
 * sites whose repository is still approved, with nothing newer queued or
 * built and no automatic rebuild for this fingerprint yet. Oldest first.
 */
async function outdatedLiveDeployments(
  tx: SiteStorageTransaction,
  renderFingerprint: string,
  limit: number,
  siteIds: readonly string[] | undefined
) {
  const live = aliasedTable(siteDeployments, "live");
  const other = aliasedTable(siteDeployments, "other");
  const rows = await tx
    .select({ live })
    .from(sites)
    .innerJoin(
      live,
      and(
        eq(live.id, sites.activeProductionDeploymentId),
        eq(live.siteId, sites.id)
      )
    )
    .where(
      and(
        siteIds ? inArray(sites.id, [...siteIds]) : undefined,
        eq(sites.status, "active"),
        eq(live.kind, "production"),
        eq(live.status, "ready"),
        sql`${live.renderFingerprint} is distinct from ${renderFingerprint}`,
        eq(live.githubRepositoryId, sites.githubRepositoryId),
        exists(
          tx
            .select({ id: githubIntegrations.id })
            .from(githubIntegrations)
            .innerJoin(
              githubAppInstallations,
              eq(
                githubIntegrations.githubAppInstallationId,
                githubAppInstallations.id
              )
            )
            .where(
              repositoryApproval({
                integrationId: sites.repositoryId,
                organizationId: sites.organizationId,
                githubRepositoryId: sites.githubRepositoryId,
                installationId: sites.githubInstallationId,
                owner: sites.repositoryOwner,
                repo: sites.repositoryName,
              })
            )
        ),
        // Also after a rollback, when the live build isn't the newest one.
        notExists(
          tx
            .select({ id: other.id })
            .from(other)
            .where(
              supersedesLiveBuild(other, {
                siteId: sites.id,
                id: live.id,
                generation: live.generation,
              })
            )
        ),
        notExists(
          tx
            .select({ key: siteJobDedupeKeys.dedupeKey })
            .from(siteJobDedupeKeys)
            .where(
              eq(
                siteJobDedupeKeys.dedupeKey,
                sql`${TOOLCHAIN_REBUILD_DEDUPE_PREFIX} || ${sites.id} || ':' || ${renderFingerprint}`
              )
            )
        )
      )
    )
    .orderBy(asc(live.finishedAt), asc(sites.id))
    .limit(limit);
  return rows.map((row) => row.live);
}

/**
 * Rebuilds the live commit of sites built with an older builder once the
 * release's snapshot and render fingerprint are live. Run by the minute cron:
 * a few sites per run, one attempt per site and fingerprint.
 */
export async function queueToolchainRebuilds(
  options: ToolchainRebuildOptions = {}
): Promise<ToolchainRebuildSweep> {
  const renderFingerprint = getSitesBuilderRenderFingerprint();
  if (!renderFingerprint) {
    return { renderFingerprint, queued: [] };
  }
  // A concurrent run skips instead of counting the same free slots.
  const queued = await db.transaction(async (tx) => {
    if (!(await advisoryXactLock(tx, TOOLCHAIN_REBUILD_LOCK, { try: true }))) {
      return [];
    }
    const slots = await freeSlots(tx);
    if (slots <= 0) {
      return [];
    }
    const rebuilds: QueuedToolchainRebuild[] = [];
    for (const live of await outdatedLiveDeployments(
      tx,
      renderFingerprint,
      slots,
      options.siteIds
    )) {
      try {
        const { deployment, jobId } = await enqueueSiteDeployment(
          toolchainRebuildInput(live, renderFingerprint)
        );
        rebuilds.push({
          siteId: live.siteId,
          deploymentId: deployment.id,
          jobId,
        });
      } catch (error) {
        // A push or a suspension since this run looked; a later run decides.
        if (error instanceof SiteNotBuildableError) {
          continue;
        }
        console.warn("sites.toolchain_rebuild_enqueue_failed", {
          siteId: live.siteId,
          error: errorMessage(error),
        });
      }
    }
    return rebuilds;
  });
  return { renderFingerprint, queued };
}
