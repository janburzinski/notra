import { artifactWhere } from "@notra/ai/chat/artifacts";
import { ARTIFACT_SHARE_ID_LENGTH } from "@notra/ai/constants/artifacts";
import { artifactSharePath } from "@notra/ai/utils/artifact-path";
import { db } from "@notra/db/drizzle";
import { artifacts } from "@notra/db/schema";
import { and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Turns the public link on or off. Turning it on again keeps the link people
 * already have; turning it off breaks it for good.
 */
export async function setArtifactShared(
  organizationId: string,
  artifactId: string,
  shared: boolean
): Promise<{ sharePath: string | null } | null> {
  const readShareId = () =>
    db.query.artifacts.findFirst({
      columns: { shareId: true },
      where: artifactWhere(organizationId, artifactId),
    });
  const current = await readShareId();
  if (!current) {
    return null;
  }
  if (!shared) {
    await db
      .update(artifacts)
      .set({ shareId: null })
      .where(artifactWhere(organizationId, artifactId));
    return { sharePath: null };
  }
  if (current.shareId) {
    return { sharePath: artifactSharePath(current.shareId) };
  }
  // Two members sharing at once both see no link: only the first id is
  // saved, and the other gets that same link back instead of its own.
  const [saved] = await db
    .update(artifacts)
    .set({ shareId: nanoid(ARTIFACT_SHARE_ID_LENGTH) })
    .where(
      and(artifactWhere(organizationId, artifactId), isNull(artifacts.shareId))
    )
    .returning({ shareId: artifacts.shareId });
  const shareId = saved?.shareId ?? (await readShareId())?.shareId;
  return shareId ? { sharePath: artifactSharePath(shareId) } : null;
}

/**
 * Deletes an artifact for good: the row and, by cascade, every saved
 * version, as the DPA's deletion terms require. Chats and links show it as
 * gone, and a brief built on it falls back to its own page.
 */
export async function deleteArtifact(
  organizationId: string,
  artifactId: string
): Promise<boolean> {
  const deleted = await db
    .delete(artifacts)
    .where(artifactWhere(organizationId, artifactId))
    .returning({ id: artifacts.id });
  return deleted.length > 0;
}
