import { artifactRepoId, artifactWhere } from "@notra/ai/chat/artifacts";
import { ARTIFACT_SHARE_ID_LENGTH } from "@notra/ai/constants/artifacts";
import { artifactSharePath } from "@notra/ai/utils/artifact-path";
import { db } from "@notra/db/drizzle";
import { artifacts, codeStorageDeletions } from "@notra/db/schema";
import { getRepoStore } from "@notra/memory/repos";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { ARTIFACT_REPO_DELETE_TIMEOUT_MS } from "@/constants/artifacts";

/**
 * Publishes the current version at the public link, or takes the link down.
 * Publishing again keeps the link people already have and moves it to the
 * newest version; taking it down breaks it for good.
 */
export async function setArtifactShared(
  organizationId: string,
  artifactId: string,
  shared: boolean
): Promise<{ sharePath: string | null; shareVersion: number | null } | null> {
  const [row] = await db
    .update(artifacts)
    .set(
      shared
        ? {
            // Two members publishing at once keep one link: the first id wins.
            shareId: sql`coalesce(${artifacts.shareId}, ${nanoid(ARTIFACT_SHARE_ID_LENGTH)})`,
            shareVersion: sql`${artifacts.currentVersion}`,
            shareContent: sql`${artifacts.content}`,
            // Publishing isn't an edit.
            updatedAt: sql`${artifacts.updatedAt}`,
          }
        : {
            shareId: null,
            shareVersion: null,
            shareContent: null,
            updatedAt: sql`${artifacts.updatedAt}`,
          }
    )
    .where(artifactWhere(organizationId, artifactId))
    .returning({
      shareId: artifacts.shareId,
      shareVersion: artifacts.shareVersion,
    });
  if (!row) {
    return null;
  }
  return {
    sharePath: row.shareId ? artifactSharePath(row.shareId) : null,
    shareVersion: row.shareVersion,
  };
}

/**
 * Deletes an artifact for good: the row, its revisions and its repository
 * with every version, as the DPA's deletion terms require. Deleting the row
 * queues the repository; it is deleted right away when code.storage answers
 * in time, otherwise by the cron. Chats and links show it as gone, and a
 * brief built on it falls back to its own page.
 */
export async function deleteArtifact(
  organizationId: string,
  artifactId: string
): Promise<boolean> {
  const deleted = await db
    .delete(artifacts)
    .where(artifactWhere(organizationId, artifactId))
    .returning({ id: artifacts.id });
  if (deleted.length === 0) {
    return false;
  }
  const repoId = artifactRepoId(artifactId);
  try {
    await getRepoStore().deleteRepo(
      repoId,
      AbortSignal.timeout(ARTIFACT_REPO_DELETE_TIMEOUT_MS)
    );
    await db
      .delete(codeStorageDeletions)
      .where(eq(codeStorageDeletions.repoId, repoId));
  } catch {
    // Still queued; the cron retries.
  }
  return true;
}
