import { verifyGitHubWebhookSignature } from "@notra/ai/utils/github-webhook-signature";
import { db } from "@notra/db/drizzle";
import {
  githubAppInstallations,
  githubIntegrations,
  siteDeployments,
  sites,
  siteWebhookDeliveries,
} from "@notra/db/schema";
import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";
import {
  branchPreviewKey,
  pullRequestPreviewKey,
} from "@notra/sites-core/utils/hosts";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { readLiveDeployments } from "./activation";
import {
  BRANCH_REF_PREFIX,
  PREVIEW_PR_ACTIONS,
  SITES_WEBHOOK_EVENTS,
  WEBHOOK_CLAIM_LEASE_SECONDS,
  ZERO_SHA,
} from "./constants/webhooks";
import {
  enqueuePreviewRemoval,
  enqueueSiteDeployment,
  getDeployment,
} from "./deployments";
import { SiteNotBuildableError } from "./errors/sites";
import { pullRequestChangedPaths, siteRepositoryAccess } from "./github";
import type { EnqueueDeploymentInput } from "./types/deployments";
import type { Site } from "./types/sites";
import type {
  CheckRunPayload,
  PullRequestPayload,
  PushPayload,
  SitesWebhookParams,
  SitesWebhookResult,
} from "./types/webhooks";
import { redeploymentInput } from "./utils/deployments";
import {
  pathsTouchRootDirectory,
  pushTouchesRootDirectory,
} from "./utils/push-paths";

async function enqueueOrSkip(
  input: EnqueueDeploymentInput
): Promise<string | null> {
  try {
    return (await enqueueSiteDeployment(input)).jobId;
  } catch (error) {
    if (error instanceof SiteNotBuildableError) {
      console.warn("sites.webhook_deploy_skipped", {
        siteId: input.siteId,
        reason: error.message,
      });
      return null;
    }
    throw error;
  }
}

/**
 * One job per site and delivery: GitHub redelivers the same delivery id, so
 * a retry finds the sites it already queued instead of building them again.
 */
function deliveryJobKey(deliveryId: string, siteId: string) {
  return `github:${deliveryId}:${siteId}`;
}

/**
 * Queues every site even when one fails, so a failure cannot leave later
 * sites unbuilt. Any failure still fails the delivery for a redelivery.
 */
async function enqueueForEachSite(
  siteList: readonly Site[],
  enqueue: (site: Site) => Promise<string | null>
): Promise<string[]> {
  const jobIds: string[] = [];
  const failures: unknown[] = [];
  for (const site of siteList) {
    try {
      const jobId = await enqueue(site);
      if (jobId) {
        jobIds.push(jobId);
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, "Some sites could not be queued");
  }
  return jobIds;
}

async function isPreviewOpen(
  siteId: string,
  previewKey: string
): Promise<boolean> {
  const live = await readLiveDeployments(siteId);
  if (previewKey in live.previews) {
    return true;
  }
  const [building] = await db
    .select({ id: siteDeployments.id })
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        eq(siteDeployments.previewKey, previewKey),
        inArray(siteDeployments.status, [
          ...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
        ])
      )
    )
    .limit(1);
  return Boolean(building);
}

async function sitesForRepository(
  repositoryId: number,
  installationId: number | undefined
) {
  if (!installationId) {
    return [];
  }
  return await db
    .select({ site: sites })
    .from(sites)
    .innerJoin(
      githubIntegrations,
      and(
        eq(sites.repositoryId, githubIntegrations.id),
        eq(sites.organizationId, githubIntegrations.organizationId),
        eq(sites.githubRepositoryId, githubIntegrations.githubRepositoryId),
        eq(sites.repositoryOwner, githubIntegrations.owner),
        eq(sites.repositoryName, githubIntegrations.repo)
      )
    )
    .innerJoin(
      githubAppInstallations,
      and(
        eq(
          githubIntegrations.githubAppInstallationId,
          githubAppInstallations.id
        ),
        eq(sites.organizationId, githubAppInstallations.organizationId),
        eq(sites.githubInstallationId, githubAppInstallations.installationId)
      )
    )
    .where(
      and(
        eq(sites.githubRepositoryId, String(repositoryId)),
        eq(sites.githubInstallationId, String(installationId)),
        eq(sites.status, "active"),
        eq(githubIntegrations.enabled, true),
        eq(githubIntegrations.repositoryEnabled, true),
        eq(githubAppInstallations.enabled, true)
      )
    )
    .then((rows) => rows.map(({ site }) => site));
}

async function handlePush(
  payload: PushPayload,
  deliveryId: string
): Promise<string[]> {
  if (
    !payload.ref.startsWith(BRANCH_REF_PREFIX) ||
    payload.deleted ||
    ZERO_SHA.test(payload.after)
  ) {
    return [];
  }
  const branch = payload.ref.slice(BRANCH_REF_PREFIX.length);
  const commit = {
    trigger: "push",
    branch,
    commitSha: payload.after,
    commitMessage: payload.head_commit?.message?.split("\n")[0] ?? null,
    commitAuthor: payload.head_commit?.author?.name ?? null,
  } as const;
  const siteList = await sitesForRepository(
    payload.repository.id,
    payload.installation?.id
  );
  return await enqueueForEachSite(siteList, async (site) => {
    const previewKey =
      branch === site.productionBranch
        ? null
        : branchPreviewKey(branch, site.slug);
    if (
      previewKey &&
      !(site.previewsEnabled && (await isPreviewOpen(site.id, previewKey)))
    ) {
      return null;
    }
    if (!pushTouchesRootDirectory(payload, site.rootDirectory)) {
      return null;
    }
    return await enqueueOrSkip({
      deduplicateCommit: !previewKey,
      dedupeKey: deliveryJobKey(deliveryId, site.id),
      ...commit,
      siteId: site.id,
      kind: previewKey ? "preview" : "production",
      previewKey,
      githubRepositoryId: String(payload.repository.id),
    });
  });
}

/**
 * Whether a pull request changes a site's folder. Sites sharing a repository
 * share one lookup per pull request, and any failure counts as a change.
 */
function pullRequestPathsLookup() {
  const cache = new Map<number, Promise<string[] | null>>();
  return (site: Site, pullNumber: number, rootDirectory: string) => {
    let paths = cache.get(pullNumber);
    if (!paths) {
      paths = siteRepositoryAccess(site, { pull_requests: "read" })
        .then(({ repository, token }) =>
          pullRequestChangedPaths(repository, token, pullNumber)
        )
        .catch(() => null);
      cache.set(pullNumber, paths);
    }
    return paths.then(
      (changed) =>
        changed === null || pathsTouchRootDirectory(changed, rootDirectory)
    );
  };
}

async function handlePullRequest(
  payload: PullRequestPayload,
  deliveryId: string
): Promise<string[]> {
  const previewKey = pullRequestPreviewKey(payload.number);
  const pullRequestTouchesRootDirectory = pullRequestPathsLookup();
  const siteList = await sitesForRepository(
    payload.repository.id,
    payload.installation?.id
  );
  return await enqueueForEachSite(siteList, async (site) => {
    const dedupeKey = deliveryJobKey(deliveryId, site.id);
    if (payload.action === "closed") {
      return await enqueuePreviewRemoval(site.id, previewKey, dedupeKey);
    }
    if (!(PREVIEW_PR_ACTIONS.has(payload.action) && site.previewsEnabled)) {
      return null;
    }
    const fromSameRepository =
      payload.pull_request.head.repo?.id === payload.repository.id;
    if (
      payload.pull_request.base.ref !== site.productionBranch ||
      !fromSameRepository
    ) {
      return null;
    }
    if (
      site.rootDirectory &&
      !(await isPreviewOpen(site.id, previewKey).catch(() => true)) &&
      !(await pullRequestTouchesRootDirectory(
        site,
        payload.number,
        site.rootDirectory
      ))
    ) {
      return null;
    }
    return await enqueueOrSkip({
      dedupeKey,
      siteId: site.id,
      kind: "preview",
      previewKey,
      trigger: "pull_request",
      branch: payload.pull_request.head.ref,
      commitSha: payload.pull_request.head.sha,
      commitMessage: payload.pull_request.title,
      commitAuthor: payload.pull_request.user?.login ?? null,
      pullRequestNumber: payload.number,
      githubRepositoryId: String(payload.repository.id),
    });
  });
}

async function handleCheckRun(
  payload: CheckRunPayload,
  deliveryId: string
): Promise<string[]> {
  if (
    payload.action !== "rerequested" ||
    !payload.check_run.external_id?.startsWith("dep_")
  ) {
    return [];
  }
  const previous = await getDeployment(payload.check_run.external_id);
  if (!previous) {
    return [];
  }
  const site = (
    await sitesForRepository(payload.repository.id, payload.installation?.id)
  ).find((candidate) => candidate.id === previous.siteId);
  if (!site) {
    return [];
  }
  const jobId = await enqueueOrSkip({
    ...redeploymentInput(previous, null),
    dedupeKey: deliveryJobKey(deliveryId, site.id),
  });
  return jobId ? [jobId] : [];
}

export async function handleSitesWebhook(
  params: SitesWebhookParams
): Promise<SitesWebhookResult | null> {
  if (!SITES_WEBHOOK_EVENTS.has(params.event)) {
    return null;
  }
  if (
    !verifyGitHubWebhookSignature(
      params.rawBody,
      params.signature,
      params.secret
    )
  ) {
    return {
      httpStatus: 401,
      body: { error: "Invalid webhook signature" },
      jobIds: [],
    };
  }
  if (!params.deliveryId) {
    return {
      httpStatus: 400,
      body: { error: "Missing X-GitHub-Delivery header" },
      jobIds: [],
    };
  }
  const claimed = await db
    .insert(siteWebhookDeliveries)
    .values({ deliveryId: params.deliveryId, event: params.event })
    .onConflictDoUpdate({
      target: siteWebhookDeliveries.deliveryId,
      set: { receivedAt: sql`now()` },
      setWhere: and(
        isNull(siteWebhookDeliveries.processedAt),
        lt(
          siteWebhookDeliveries.receivedAt,
          sql`now() - make_interval(secs => ${WEBHOOK_CLAIM_LEASE_SECONDS})`
        )
      ),
    })
    .returning({ deliveryId: siteWebhookDeliveries.deliveryId });
  if (claimed.length === 0) {
    return {
      httpStatus: 200,
      body: { message: "duplicate delivery" },
      jobIds: [],
    };
  }
  try {
    const payload = JSON.parse(params.rawBody) as unknown;
    let jobIds: string[] = [];
    if (params.event === "push") {
      jobIds = await handlePush(payload as PushPayload, params.deliveryId);
    } else if (params.event === "pull_request") {
      jobIds = await handlePullRequest(
        payload as PullRequestPayload,
        params.deliveryId
      );
    } else if (params.event === "check_run") {
      jobIds = await handleCheckRun(
        payload as CheckRunPayload,
        params.deliveryId
      );
    }
    await db
      .update(siteWebhookDeliveries)
      .set({ processedAt: new Date() })
      .where(eq(siteWebhookDeliveries.deliveryId, params.deliveryId));
    return {
      httpStatus: 200,
      body: { message: "ok", queued: jobIds.length },
      jobIds,
    };
  } catch (error) {
    await db
      .delete(siteWebhookDeliveries)
      .where(eq(siteWebhookDeliveries.deliveryId, params.deliveryId));
    throw error;
  }
}
