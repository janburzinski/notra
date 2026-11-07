import { TOOLCHAIN_REBUILD_DEDUPE_PREFIX } from "../constants/toolchain-rebuilds";
import type {
  SiteDeployment,
  EnqueueDeploymentInput,
} from "../types/deployments";

export function redeploymentInput(
  previous: SiteDeployment,
  requestedByUserId: string | null
): EnqueueDeploymentInput {
  return {
    siteId: previous.siteId,
    kind: previous.kind,
    previewKey: previous.previewKey,
    trigger: "redeploy",
    branch: previous.branch,
    commitSha: previous.commitSha,
    commitMessage: previous.commitMessage,
    commitAuthor: previous.commitAuthor,
    pullRequestNumber: previous.pullRequestNumber,
    requestedByUserId,
    githubRepositoryId: previous.githubRepositoryId,
  };
}

/** One automatic rebuild per site and render fingerprint, whatever its outcome. */
function toolchainRebuildDedupeKey(
  siteId: string,
  renderFingerprint: string
): string {
  return `${TOOLCHAIN_REBUILD_DEDUPE_PREFIX}${siteId}:${renderFingerprint}`;
}

export function toolchainRebuildInput(
  live: SiteDeployment,
  renderFingerprint: string
): EnqueueDeploymentInput {
  return {
    ...redeploymentInput(live, null),
    trigger: "toolchain",
    dedupeKey: toolchainRebuildDedupeKey(live.siteId, renderFingerprint),
    liveDeploymentId: live.id,
  };
}
