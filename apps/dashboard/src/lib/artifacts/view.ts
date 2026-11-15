import {
  artifactFindingIds,
  readArtifact,
  readSharedArtifact,
} from "@notra/ai/chat/artifacts";
import type { ArtifactBlock } from "@notra/ai/types/artifact";
import { artifactSharePath } from "@notra/ai/utils/artifact-path";

import { loadAutopilotActionContext } from "@/lib/autopilot/action-context";
import { loadBriefFindings } from "@/lib/autopilot/brief-page";
import { recoverStaleFindings } from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { findingDisplayTitle } from "@/utils/autopilot-findings";

/**
 * The current state of every Autopilot item an artifact shows, so its
 * buttons act on what is true now rather than when the agent wrote it.
 */
async function loadArtifactAutopilot(
  organizationId: string,
  role: string,
  blocks: ArtifactBlock[]
) {
  const findingIds = artifactFindingIds(blocks);
  if (
    findingIds.length === 0 ||
    !(await isAutopilotEnabledForOrganization(organizationId))
  ) {
    return null;
  }
  await recoverStaleFindings(organizationId);
  const [findings, actions] = await Promise.all([
    loadBriefFindings(organizationId, { findingIds, mergedIds: [] }),
    loadAutopilotActionContext(organizationId, role),
  ]);
  return { findings, ...actions };
}

export async function loadArtifactView(params: {
  organizationId: string;
  artifactId: string;
  version?: number;
  role: string;
}) {
  const read = await readArtifact(
    params.organizationId,
    params.artifactId,
    params.version
  );
  if (!read) {
    return null;
  }
  const { artifact } = read;
  return {
    id: artifact.id,
    source: artifact.source,
    chatId: artifact.chatId,
    title: read.content.title,
    summary: read.content.summary,
    blocks: read.content.blocks,
    version: read.version,
    currentVersion: artifact.currentVersion,
    versionCreatedAt: read.versionCreatedAt,
    versions: read.versions,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    sharePath: artifact.shareId ? artifactSharePath(artifact.shareId) : null,
    autopilot: await loadArtifactAutopilot(
      params.organizationId,
      params.role,
      read.content.blocks
    ),
  };
}

/**
 * A public copy shows the words and numbers. Autopilot items keep only their
 * title and stage: no buttons, links or branch names leave the workspace.
 */
export async function loadSharedArtifactView(shareId: string) {
  const shared = await readSharedArtifact(shareId);
  if (!shared) {
    return null;
  }
  const findingIds = artifactFindingIds(shared.content.blocks);
  const findings =
    findingIds.length > 0 &&
    (await isAutopilotEnabledForOrganization(shared.organizationId))
      ? await loadBriefFindings(shared.organizationId, {
          findingIds,
          mergedIds: [],
        })
      : [];
  return {
    source: shared.source,
    title: shared.content.title,
    summary: shared.content.summary,
    blocks: shared.content.blocks,
    version: shared.version,
    updatedAt: shared.updatedAt,
    findings: findings.map((finding) => ({
      id: finding.id,
      kind: finding.kind,
      title: findingDisplayTitle(finding),
      status: finding.status,
    })),
  };
}
