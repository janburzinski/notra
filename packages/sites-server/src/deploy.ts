import { selectProductionDeployment } from "./activation";
import { enqueueSiteDeployment, getDeployment } from "./deployments";
import { SiteInputError } from "./errors";
import { getBranchHead, siteRepositoryAccess } from "./github";
import type { DeployBranchHeadOptions, Site } from "./types/sites";
import { redeploymentInput } from "./utils/deployments";

export async function deployBranchHead(
  site: Site,
  options: DeployBranchHeadOptions
): Promise<string> {
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
  });
  const branch = options.branch ?? site.productionBranch;
  const head = await getBranchHead(repository, token, branch);
  const previewKey = options.previewKey ?? null;
  const { jobId } = await enqueueSiteDeployment({
    siteId: site.id,
    kind: previewKey ? "preview" : "production",
    previewKey,
    trigger: options.trigger,
    branch,
    commitSha: head.sha,
    commitMessage: options.commitMessage ?? head.message,
    commitAuthor: head.author,
    requestedByUserId: options.userId ?? null,
  });
  return jobId;
}

export async function redeploy(
  site: Site,
  deploymentId: string,
  userId: string
): Promise<string> {
  const previous = await getDeployment(deploymentId);
  if (previous?.siteId !== site.id) {
    throw new SiteInputError("Deployment not found");
  }
  const { jobId } = await enqueueSiteDeployment(
    redeploymentInput(previous, userId)
  );
  return jobId;
}

export async function rollbackToDeployment(
  site: Site,
  deploymentId: string
): Promise<void> {
  await selectProductionDeployment(site, deploymentId);
}

export async function promoteLatestDeployment(site: Site): Promise<void> {
  await selectProductionDeployment(site, null);
}
