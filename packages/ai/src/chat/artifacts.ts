import {
  ARTIFACT_ID_LENGTH,
  ARTIFACT_LIMITS,
} from "@notra/ai/constants/artifacts";
import { artifactBlockSchema } from "@notra/ai/schemas/artifact";
import type {
  ArtifactBlock,
  ArtifactContent,
  ArtifactWriter,
  SavedArtifact,
} from "@notra/ai/types/artifact";
import { artifactPath } from "@notra/ai/utils/artifact-path";
import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import {
  artifacts,
  artifactVersions,
  autopilotFindings,
  chatSessions,
} from "@notra/db/schema";
import type { StoredArtifactContent } from "@notra/db/types/artifacts";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export class ArtifactNotFoundError extends Error {
  constructor() {
    super("No artifact with this id in this workspace.");
    this.name = "ArtifactNotFoundError";
  }
}

export function artifactUrl(artifactId: string) {
  return `${getAppUrl() ?? ""}${artifactPath(artifactId)}`;
}

/** An artifact in this workspace that hasn't been deleted. */
export function artifactWhere(organizationId: string, artifactId: string) {
  return and(
    eq(artifacts.organizationId, organizationId),
    eq(artifacts.id, artifactId),
    isNull(artifacts.deletedAt)
  );
}

/** Every Autopilot finding the blocks point at, once each. */
export function artifactFindingIds(blocks: ArtifactBlock[]) {
  return [
    ...new Set(
      blocks.flatMap((block) =>
        block.type === "autopilot" ? block.findingIds : []
      )
    ),
  ];
}

/** Keeps the blocks this renderer understands; one bad block never hides the rest. */
export function parseArtifactContent(stored: StoredArtifactContent): {
  title: string;
  summary: string | null;
  blocks: ArtifactBlock[];
} {
  const blocks: ArtifactBlock[] = [];
  for (const block of stored.blocks) {
    const parsed = artifactBlockSchema.safeParse(block);
    if (parsed.success) {
      blocks.push(parsed.data);
    }
  }
  return { title: stored.title, summary: stored.summary ?? null, blocks };
}

/**
 * Autopilot blocks may only point at this workspace's findings. Unknown ids
 * are dropped, and a block left empty goes with them, so a guessed id never
 * renders as a broken row.
 */
async function checkFindingIds(
  organizationId: string,
  blocks: ArtifactBlock[]
): Promise<{ blocks: ArtifactBlock[]; warnings: string[] }> {
  const requested = artifactFindingIds(blocks);
  if (requested.length === 0) {
    return { blocks, warnings: [] };
  }
  const found = await db
    .select({ id: autopilotFindings.id })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        inArray(autopilotFindings.id, requested)
      )
    );
  const known = new Set(found.map((row) => row.id));
  const unknown = requested.filter((id) => !known.has(id));
  const kept = blocks.flatMap((block): ArtifactBlock[] => {
    if (block.type !== "autopilot") {
      return [block];
    }
    const findingIds = [...new Set(block.findingIds)].filter((id) =>
      known.has(id)
    );
    return findingIds.length > 0 ? [{ ...block, findingIds }] : [];
  });
  return {
    blocks: kept,
    warnings:
      unknown.length > 0
        ? [
            `Left out unknown Autopilot finding ids: ${unknown.join(", ")}. Read them from the Autopilot status.`,
          ]
        : [],
  };
}

async function prepareContent(
  organizationId: string,
  content: ArtifactContent
): Promise<{ stored: StoredArtifactContent; warnings: string[] }> {
  const { blocks, warnings } = await checkFindingIds(
    organizationId,
    content.blocks
  );
  if (blocks.length === 0) {
    throw new Error(
      "The artifact has no blocks left to show. Add text, metrics, a chart or a table."
    );
  }
  return {
    stored: {
      title: content.title,
      summary: content.summary ?? null,
      blocks,
    },
    warnings,
  };
}

/** A chat that isn't saved yet (or belongs elsewhere) leaves the artifact unlinked. */
async function linkableChatId(organizationId: string, chatId: string) {
  const chat = await db.query.chatSessions.findFirst({
    columns: { id: true },
    where: and(
      eq(chatSessions.organizationId, organizationId),
      eq(chatSessions.id, chatId)
    ),
  });
  return chat?.id ?? null;
}

function savedArtifact(
  id: string,
  stored: StoredArtifactContent,
  version: number,
  warnings: string[]
): SavedArtifact {
  return {
    id,
    title: stored.title,
    summary: stored.summary ?? null,
    version,
    url: artifactUrl(id),
    warnings,
  };
}

export async function createArtifact(
  writer: ArtifactWriter,
  content: ArtifactContent
): Promise<SavedArtifact> {
  const [{ stored, warnings }, chatId] = await Promise.all([
    prepareContent(writer.organizationId, content),
    writer.chatId
      ? linkableChatId(writer.organizationId, writer.chatId)
      : Promise.resolve(null),
  ]);
  const id = nanoid(ARTIFACT_ID_LENGTH);
  await db.transaction(async (tx) => {
    await tx.insert(artifacts).values({
      id,
      organizationId: writer.organizationId,
      chatId,
      source: writer.source,
      title: stored.title,
      currentVersion: 1,
      createdByUserId: writer.userId ?? null,
    });
    await tx
      .insert(artifactVersions)
      .values({ artifactId: id, version: 1, content: stored });
  });
  return savedArtifact(id, stored, 1, warnings);
}

/** Saves the content as the next version; the earlier ones stay readable. */
export async function updateArtifact(
  organizationId: string,
  artifactId: string,
  content: ArtifactContent
): Promise<SavedArtifact> {
  const { stored, warnings } = await prepareContent(organizationId, content);
  const version = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(artifacts)
      .set({
        title: stored.title,
        currentVersion: sql`${artifacts.currentVersion} + 1`,
      })
      .where(artifactWhere(organizationId, artifactId))
      .returning({ version: artifacts.currentVersion });
    if (!row) {
      throw new ArtifactNotFoundError();
    }
    await tx
      .insert(artifactVersions)
      .values({ artifactId, version: row.version, content: stored });
    return row.version;
  });
  return savedArtifact(artifactId, stored, version, warnings);
}

export function findArtifact(organizationId: string, artifactId: string) {
  return db.query.artifacts.findFirst({
    where: artifactWhere(organizationId, artifactId),
  });
}

/** One version of an artifact (the current one by default) and its history. */
export async function readArtifact(
  organizationId: string,
  artifactId: string,
  version?: number
) {
  const artifact = await findArtifact(organizationId, artifactId);
  if (!artifact) {
    return null;
  }
  const wanted = version ?? artifact.currentVersion;
  const [row, versions] = await Promise.all([
    db.query.artifactVersions.findFirst({
      where: and(
        eq(artifactVersions.artifactId, artifactId),
        eq(artifactVersions.version, wanted)
      ),
    }),
    db
      .select({
        version: artifactVersions.version,
        createdAt: artifactVersions.createdAt,
      })
      .from(artifactVersions)
      .where(eq(artifactVersions.artifactId, artifactId))
      .orderBy(desc(artifactVersions.version))
      .limit(ARTIFACT_LIMITS.versionsListed),
  ]);
  if (!row) {
    return null;
  }
  return {
    artifact,
    version: row.version,
    versionCreatedAt: row.createdAt,
    content: parseArtifactContent(row.content),
    versions,
  };
}

/**
 * What the get tools hand the model: the current version's content, read
 * with one join and without the version history it has no use for.
 */
export async function readArtifactForModel(
  organizationId: string,
  artifactId: string
) {
  const [row] = await db
    .select({
      version: artifacts.currentVersion,
      content: artifactVersions.content,
    })
    .from(artifacts)
    .innerJoin(
      artifactVersions,
      and(
        eq(artifactVersions.artifactId, artifacts.id),
        eq(artifactVersions.version, artifacts.currentVersion)
      )
    )
    .where(artifactWhere(organizationId, artifactId))
    .limit(1);
  if (!row) {
    throw new ArtifactNotFoundError();
  }
  return {
    artifactId,
    version: row.version,
    ...parseArtifactContent(row.content),
  };
}

/** The current version of a publicly shared artifact. */
export async function readSharedArtifact(shareId: string) {
  const [row] = await db
    .select({
      id: artifacts.id,
      organizationId: artifacts.organizationId,
      source: artifacts.source,
      version: artifacts.currentVersion,
      updatedAt: artifacts.updatedAt,
      content: artifactVersions.content,
    })
    .from(artifacts)
    .innerJoin(
      artifactVersions,
      and(
        eq(artifactVersions.artifactId, artifacts.id),
        eq(artifactVersions.version, artifacts.currentVersion)
      )
    )
    .where(and(eq(artifacts.shareId, shareId), isNull(artifacts.deletedAt)))
    .limit(1);
  if (!row) {
    return null;
  }
  return { ...row, content: parseArtifactContent(row.content) };
}

/** What a tool hands back: enough for the chat card, not the whole content. */
export function artifactToolOutput(saved: SavedArtifact) {
  return {
    // The summary lets the chat card render without loading the artifact.
    artifact: {
      id: saved.id,
      title: saved.title,
      summary: saved.summary,
      version: saved.version,
    },
    url: saved.url,
    ...(saved.warnings.length > 0 ? { warnings: saved.warnings } : {}),
  };
}

export function artifactModelText(
  saved: ReturnType<typeof artifactToolOutput>,
  surface: "chat" | "slack"
) {
  const shown =
    surface === "slack"
      ? "A message with an Open button was posted in the thread."
      : "The user sees it as a card in the chat and can open it.";
  return [
    `Saved artifact "${saved.artifact.title}" (id ${saved.artifact.id}, version ${saved.artifact.version}) at ${saved.url}.`,
    shown,
    "Do not repeat its contents; reply with one or two sentences on the takeaway.",
    ...(saved.warnings ?? []),
  ].join(" ");
}
