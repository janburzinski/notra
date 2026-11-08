import { db } from "@notra/db/drizzle";
import { posts, siteDomains, siteJobs } from "@notra/db/schema";
import { SITE_API_BUILD_LOG_MAX_CHARS } from "@notra/schemas/constants/sites-api";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import { getBuildTelemetry } from "@notra/sites-server/build-telemetry";
import { deployBranchHead, redeploy } from "@notra/sites-server/deploy";
import {
  getDeployment,
  getSite,
  listSiteDeployments,
} from "@notra/sites-server/deployments";
import { r2GetText } from "@notra/sites-server/r2";
import { readServingState } from "@notra/sites-server/state";
import type { Site } from "@notra/sites-server/types/sites";
import { and, eq } from "drizzle-orm";

import { afterResponse } from "@/lib/framework/after-response";
import { publishSavedContentToGitHub } from "@/lib/integrations/github/publish-saved-content";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { dispatchSiteJobs } from "@/lib/sites/dispatch";
import {
  listPostPreviewSites,
  postPreviewStatus,
  previewPostOnSite,
} from "@/lib/sites/post-preview";
import {
  liveDeploymentsFromState,
  serializeDeployment,
  serializeDomain,
  serializePreviews,
  serializeSite,
} from "@/lib/sites/serialize";
import type { SiteApiRequest } from "@/types/sites-public-api";
import { ratelimit } from "@/utils/ratelimit";

async function servingState(siteId: string) {
  return (await readServingState(siteId))?.state ?? null;
}

async function requireOrganizationSite(input: SiteApiRequest) {
  const site = await getSite(input.siteId);
  if (!site || site.organizationId !== input.organizationId) {
    throw notFound("Site not found");
  }
  return site;
}

// Reuses the budgets of agent previews and agent pull requests.
async function assertWithinLimit(
  limiter: "agent-preview" | "agent",
  organizationId: string,
  message: string
) {
  if (
    !(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    )
  ) {
    return;
  }
  const { success } = await ratelimit.githubPublish.limit(
    `${limiter}:${organizationId}`
  );
  if (!success) {
    throw tooManyRequests(message);
  }
}

function tail(log: string | null) {
  if (!log || log.length <= SITE_API_BUILD_LOG_MAX_CHARS) {
    return { log, logTruncated: false };
  }
  return { log: log.slice(-SITE_API_BUILD_LOG_MAX_CHARS), logTruncated: true };
}

async function serializeQueuedDeployment(site: Site, jobId: string) {
  const [job] = await db
    .select({ deploymentId: siteJobs.deploymentId })
    .from(siteJobs)
    .where(eq(siteJobs.id, jobId))
    .limit(1);
  const deployment = job?.deploymentId
    ? await getDeployment(job.deploymentId)
    : null;
  if (!deployment) {
    throw notFound("Deployment not found");
  }
  afterResponse(() => dispatchSiteJobs([jobId]));
  return {
    deployment: serializeDeployment(
      deployment,
      liveDeploymentsFromState(await servingState(site.id))
    ),
  };
}

async function getSiteDetail(site: Site) {
  const [domains, state] = await Promise.all([
    db.select().from(siteDomains).where(eq(siteDomains.siteId, site.id)),
    servingState(site.id),
  ]);
  const live = liveDeploymentsFromState(state);
  const deployments = await listSiteDeployments(site.id, live.size || 1, [
    ...live.keys(),
  ]);
  return {
    site: serializeSite(site, state),
    domains: domains.map((domain) => serializeDomain(site, domain)),
    previews: serializePreviews(site, state, deployments),
  };
}

async function getDeploymentDetail(site: Site, deploymentId: string) {
  const deployment = await getDeployment(deploymentId);
  if (!deployment || deployment.siteId !== site.id) {
    throw notFound("Deployment not found");
  }
  const [log, state, telemetry] = await Promise.all([
    r2GetText(SITE_R2_KEYS.buildLog(site.id, deployment.id)).catch(() => null),
    servingState(site.id),
    getBuildTelemetry(deployment.id),
  ]);
  const inProgress =
    deployment.status === "building" || deployment.status === "uploading";
  return {
    deployment: serializeDeployment(
      deployment,
      liveDeploymentsFromState(state)
    ),
    ...tail(
      inProgress
        ? (log?.text ?? telemetry?.log ?? null)
        : (telemetry?.log ?? log?.text ?? null)
    ),
  };
}

async function redeployDeployment(
  site: Site,
  input: { deploymentId: string; actorUserId: string | null }
) {
  // Rebuilding production from before the live build is a rollback, which
  // the dashboard keeps for owners and admins.
  if (site.activeProductionDeploymentId) {
    const [target, active] = await Promise.all([
      getDeployment(input.deploymentId),
      getDeployment(site.activeProductionDeploymentId),
    ]);
    if (
      target?.kind === "production" &&
      active &&
      target.generation < active.generation
    ) {
      throw forbidden(
        "Rebuilding a production deployment older than the live one is a rollback. Roll back in the dashboard."
      );
    }
  }
  return await serializeQueuedDeployment(
    site,
    await redeploy(site, input.deploymentId, input.actorUserId, {
      refuseRollback: true,
    })
  );
}

async function previewPost(
  site: Site,
  input: Extract<SiteApiRequest, { action: "previewPost" }>
) {
  const candidates = await listPostPreviewSites(
    input.organizationId,
    input.postId
  );
  if (!candidates.some((candidate) => candidate.id === site.id)) {
    throw badRequest(
      "This Site can't preview the post. It needs a section for the post's content type and previews turned on."
    );
  }
  if (site.status !== "active") {
    throw badRequest("The Site is suspended");
  }
  await assertWithinLimit(
    "agent-preview",
    input.organizationId,
    "Too many post previews. Try again later."
  );
  const result = await previewPostOnSite({
    site,
    postId: input.postId,
    userId: input.actorUserId ?? undefined,
    lifetime: input.lifetime,
    password: input.password,
  });
  afterResponse(() => dispatchSiteJobs([result.jobId]));
  return { preview: await postPreviewStatus(site, input.postId) };
}

async function publishPost(
  site: Site,
  input: Extract<SiteApiRequest, { action: "publishPost" }>
) {
  if (!site.repositoryId) {
    throw badRequest("The Site has no connected repository");
  }
  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, input.postId),
      eq(posts.organizationId, input.organizationId)
    ),
    columns: { contentType: true, githubPublish: true },
  });
  if (!post) {
    throw notFound("Post not found");
  }
  // Publishing reuses a post's existing destination, which would quietly
  // update another Site's pull request instead of this Site.
  const existing = postGitHubPublishSchema.safeParse(post.githubPublish);
  if (
    existing.success &&
    existing.data.siteId &&
    existing.data.siteId !== site.id
  ) {
    throw conflict(
      "This post is already published to another Site. Publish it there, or move it to this Site in the dashboard."
    );
  }
  if (post.contentType !== "blog_post" && post.contentType !== "changelog") {
    throw badRequest(
      "Only blog posts and changelogs can be published to a Site"
    );
  }
  await assertWithinLimit(
    "agent",
    input.organizationId,
    "Too many GitHub publish requests. Try again later."
  );
  // API output always goes through review, even on direct-publish repositories.
  return await publishSavedContentToGitHub(
    {
      organizationId: input.organizationId,
      contentId: input.postId,
      contentType: post.contentType,
      repositoryId: site.repositoryId,
      siteId: site.id,
    },
    {
      requirePullRequest: true,
      publisherUserId: input.actorUserId ?? undefined,
    }
  );
}

export async function runSiteApiAction(input: SiteApiRequest) {
  const site = await requireOrganizationSite(input);
  switch (input.action) {
    case "get":
      return await getSiteDetail(site);
    case "listDeployments": {
      const live = liveDeploymentsFromState(await servingState(site.id));
      const deployments = await listSiteDeployments(site.id, input.limit, [
        ...live.keys(),
      ]);
      return {
        deployments: deployments.map((deployment) =>
          serializeDeployment(deployment, live)
        ),
      };
    }
    case "getDeployment":
      return await getDeploymentDetail(site, input.deploymentId);
    case "deployLatest":
      return await serializeQueuedDeployment(
        site,
        await deployBranchHead(site, {
          trigger: "manual",
          userId: input.actorUserId ?? undefined,
        })
      );
    case "redeploy":
      return await redeployDeployment(site, input);
    case "previewPost":
      return await previewPost(site, input);
    case "postPreviewStatus":
      return { preview: await postPreviewStatus(site, input.postId) };
    case "publishPost":
      return await publishPost(site, input);
    default:
      throw badRequest("Unknown action");
  }
}
