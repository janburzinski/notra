import {
  ARTIFACT_AUTHORS,
  ARTIFACT_CREATE_GRACE_MS,
  ARTIFACT_FILE_PATH,
  ARTIFACT_ID_LENGTH,
  ARTIFACT_LIMITS,
  ARTIFACT_REPO_PREFIX,
} from "@notra/ai/constants/artifacts";
import { artifactBlockSchema } from "@notra/ai/schemas/artifact";
import type {
  ArtifactActor,
  ArtifactBlock,
  ArtifactContent,
  ArtifactWriter,
  SavedArtifact,
} from "@notra/ai/types/artifact";
import {
  parseArtifactFile,
  serializeArtifactFile,
} from "@notra/ai/utils/artifact-file";
import { artifactPath } from "@notra/ai/utils/artifact-path";
import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import {
  artifactRevisions,
  artifacts,
  autopilotFindings,
  chatSessions,
  codeStorageDeletions,
} from "@notra/db/schema";
import type { StoredArtifactContent } from "@notra/db/types/artifacts";
import { getRepoStore } from "@notra/memory/repos";
import { RepoConflictError } from "@notra/memory/utils/errors";
import { and, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export class ArtifactNotFoundError extends Error {
  override name = "ArtifactNotFoundError";
  constructor() {
    super("No artifact with this id in this workspace.");
  }
}

/** Someone saved a newer version; nothing was saved. */
export class ArtifactConflictError extends Error {
  override name = "ArtifactConflictError";
  readonly currentVersion: number;
  constructor(currentVersion: number) {
    super(
      `The artifact changed: it is at version ${currentVersion} now. Nothing was saved. Read it again and make your change to that version.`
    );
    this.currentVersion = currentVersion;
  }
}

export class ArtifactReadOnlyError extends Error {
  override name = "ArtifactReadOnlyError";
  constructor() {
    super(
      "Daily briefs are written by Autopilot and can't be edited. Create a new artifact instead."
    );
  }
}

/** A file the writer sent that doesn't parse; every problem names its line. */
export class ArtifactFileError extends Error {
  override name = "ArtifactFileError";
}

export function artifactRepoId(artifactId: string) {
  return `${ARTIFACT_REPO_PREFIX}${artifactId}`;
}

export function artifactUrl(artifactId: string) {
  return `${getAppUrl() ?? ""}${artifactPath(artifactId)}`;
}

/**
 * Rows with a repository. The app running while this storage deployed could
 * still insert rows without one; they are hidden until a migration drops them.
 */
export function artifactHasRepo() {
  return ne(artifacts.headSha, "");
}

export function artifactWhere(organizationId: string, artifactId: string) {
  return and(
    eq(artifacts.organizationId, organizationId),
    eq(artifacts.id, artifactId),
    artifactHasRepo()
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

function toContent(stored: StoredArtifactContent): ArtifactContent {
  const { title, summary, blocks } = parseArtifactContent(stored);
  return { title, ...(summary ? { summary } : {}), blocks };
}

/** The file a version is stored as, the same text the agent reads and writes. */
export function artifactFile(stored: StoredArtifactContent) {
  return serializeArtifactFile(toContent(stored));
}

/**
 * Reads a file a writer sent. Anything wrong is an error naming its line, so
 * the agent can fix exactly that on its next call.
 */
export function parseWrittenArtifact(file: string): ArtifactContent {
  const { content, issues } = parseArtifactFile(file);
  if (issues.length > 0 || !content) {
    const lines = issues.map((issue) => `Line ${issue.line}: ${issue.message}`);
    throw new ArtifactFileError(
      `Nothing was saved. Fix the file and send it again. ${lines.join(" ") || "The file has no blocks."}`
    );
  }
  return content;
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
    throw new ArtifactFileError(
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
  content: ArtifactContent,
  /** When it was written, if not now: a brief saved as an artifact later keeps its day. */
  options: { createdAt?: Date } = {}
): Promise<SavedArtifact> {
  const [{ stored, warnings }, chatId] = await Promise.all([
    prepareContent(writer.organizationId, content),
    writer.chatId
      ? linkableChatId(writer.organizationId, writer.chatId)
      : Promise.resolve(null),
  ]);
  const id = nanoid(ARTIFACT_ID_LENGTH);
  const repoId = artifactRepoId(id);
  const store = getRepoStore();
  // Queued before the repository exists and dequeued with the row, so a
  // repository whose row never lands is still deleted, after a grace period.
  await db.insert(codeStorageDeletions).values({
    repoId,
    nextAttemptAt: new Date(Date.now() + ARTIFACT_CREATE_GRACE_MS),
  });
  const sha = await store.create(repoId, {
    message: `Create "${stored.title}"`,
    author: ARTIFACT_AUTHORS[writer.source],
    files: { [ARTIFACT_FILE_PATH]: artifactFile(stored) },
  });
  await db.transaction(async (tx) => {
    await tx.insert(artifacts).values({
      id,
      organizationId: writer.organizationId,
      chatId,
      source: writer.source,
      title: stored.title,
      currentVersion: 1,
      headSha: sha,
      content: stored,
      createdByUserId: writer.userId ?? null,
      ...(options.createdAt
        ? { createdAt: options.createdAt, updatedAt: options.createdAt }
        : {}),
    });
    await tx.insert(artifactRevisions).values({
      artifactId: id,
      version: 1,
      sha,
      actor: writer.source,
      userId: writer.userId ?? null,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    });
    await tx
      .delete(codeStorageDeletions)
      .where(eq(codeStorageDeletions.repoId, repoId));
  });
  return savedArtifact(id, stored, 1, warnings);
}

type ArtifactHead = Pick<
  typeof artifacts.$inferSelect,
  "id" | "currentVersion" | "headSha"
>;

/** Moves the row to a commit; false when another writer moved it first. */
async function advance(
  head: ArtifactHead,
  next: {
    sha: string;
    stored: StoredArtifactContent;
    actor: ArtifactActor;
    userId?: string | null;
  }
) {
  const version = head.currentVersion + 1;
  return db.transaction(async (tx) => {
    const [moved] = await tx
      .update(artifacts)
      .set({
        title: next.stored.title,
        content: next.stored,
        headSha: next.sha,
        currentVersion: version,
      })
      .where(
        and(eq(artifacts.id, head.id), eq(artifacts.headSha, head.headSha))
      )
      .returning({ version: artifacts.currentVersion });
    if (!moved) {
      return null;
    }
    await tx.insert(artifactRevisions).values({
      artifactId: head.id,
      version,
      sha: next.sha,
      actor: next.actor,
      userId: next.userId ?? null,
    });
    return version;
  });
}

/**
 * The repository is ahead of the row when a write committed but its row
 * update was lost. The commit is the truth, so the row catches up to it.
 */
async function catchUp(head: ArtifactHead) {
  const repoId = artifactRepoId(head.id);
  const store = getRepoStore();
  const sha = await store.head(repoId);
  if (!sha || sha === head.headSha) {
    return;
  }
  const file = await store.read(repoId, ARTIFACT_FILE_PATH, sha);
  const content = file ? parseArtifactFile(file).content : null;
  if (!content) {
    return;
  }
  await advance(head, {
    sha,
    stored: { ...content, summary: content.summary ?? null },
    actor: "recovered",
  });
}

/**
 * Saves the content as the next version: one commit in the artifact's
 * repository, then the row. `baseVersion` is the version the writer read; a
 * newer one in between rejects the write instead of dropping that change.
 */
export async function updateArtifact(
  writer: ArtifactWriter & { actor?: ArtifactActor },
  artifactId: string,
  content: ArtifactContent,
  baseVersion?: number
): Promise<SavedArtifact> {
  const row = await db.query.artifacts.findFirst({
    columns: {
      id: true,
      source: true,
      currentVersion: true,
      headSha: true,
      content: true,
    },
    where: artifactWhere(writer.organizationId, artifactId),
  });
  if (!row) {
    throw new ArtifactNotFoundError();
  }
  const actor = writer.actor ?? writer.source;
  if (
    row.source === "autopilot" &&
    actor !== "autopilot" &&
    actor !== "member"
  ) {
    throw new ArtifactReadOnlyError();
  }
  if (baseVersion !== undefined && baseVersion !== row.currentVersion) {
    throw new ArtifactConflictError(row.currentVersion);
  }
  const { stored, warnings } = await prepareContent(
    writer.organizationId,
    content
  );
  const file = artifactFile(stored);
  if (file === artifactFile(row.content)) {
    return savedArtifact(artifactId, stored, row.currentVersion, [
      ...warnings,
      "Nothing changed, so no new version was saved.",
    ]);
  }
  let sha: string;
  try {
    sha = await getRepoStore().commit(artifactRepoId(artifactId), {
      expectedHeadSha: row.headSha,
      message: `Update "${stored.title}"`,
      author: ARTIFACT_AUTHORS[actor],
      files: { [ARTIFACT_FILE_PATH]: file },
    });
  } catch (error) {
    if (error instanceof RepoConflictError) {
      await catchUp(row).catch(() => undefined);
      const latest = await db.query.artifacts.findFirst({
        columns: { currentVersion: true },
        where: eq(artifacts.id, artifactId),
      });
      throw new ArtifactConflictError(
        latest?.currentVersion ?? row.currentVersion
      );
    }
    throw error;
  }
  const version = await advance(row, {
    sha,
    stored,
    actor,
    userId: writer.userId,
  });
  if (version === null) {
    // A concurrent writer's conflict may have caught the row up to our own
    // commit first: then it is saved. Otherwise our commit is in git and the
    // next write catches the row up to it.
    const latest = await db.query.artifacts.findFirst({
      columns: { currentVersion: true, headSha: true },
      where: eq(artifacts.id, artifactId),
    });
    if (latest?.headSha === sha) {
      return savedArtifact(artifactId, stored, latest.currentVersion, warnings);
    }
    throw new ArtifactConflictError(
      latest?.currentVersion ?? row.currentVersion + 1
    );
  }
  return savedArtifact(artifactId, stored, version, warnings);
}

export function findArtifact(organizationId: string, artifactId: string) {
  return db.query.artifacts.findFirst({
    where: artifactWhere(organizationId, artifactId),
  });
}

/** One saved version's file, read from git; the current one comes from the row. */
async function readArtifactVersionFile(
  organizationId: string,
  artifactId: string,
  version: number
): Promise<string | null> {
  const [row] = await db
    .select({
      currentVersion: artifacts.currentVersion,
      content: artifacts.content,
      sha: artifactRevisions.sha,
    })
    .from(artifacts)
    .innerJoin(
      artifactRevisions,
      and(
        eq(artifactRevisions.artifactId, artifacts.id),
        eq(artifactRevisions.version, version)
      )
    )
    .where(artifactWhere(organizationId, artifactId))
    .limit(1);
  if (!row) {
    return null;
  }
  if (version === row.currentVersion) {
    return artifactFile(row.content);
  }
  return getRepoStore().read(
    artifactRepoId(artifactId),
    ARTIFACT_FILE_PATH,
    row.sha
  );
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
  const versions = await db
    .select({
      version: artifactRevisions.version,
      actor: artifactRevisions.actor,
      createdAt: artifactRevisions.createdAt,
    })
    .from(artifactRevisions)
    .where(eq(artifactRevisions.artifactId, artifactId))
    .orderBy(desc(artifactRevisions.version))
    .limit(ARTIFACT_LIMITS.versionsListed);
  if (wanted === artifact.currentVersion) {
    return {
      artifact,
      version: wanted,
      versionCreatedAt: artifact.updatedAt,
      content: parseArtifactContent(artifact.content),
      versions,
    };
  }
  const file = await readArtifactVersionFile(
    organizationId,
    artifactId,
    wanted
  );
  const content = file ? parseArtifactFile(file).content : null;
  if (!content) {
    return null;
  }
  return {
    artifact,
    version: wanted,
    versionCreatedAt:
      versions.find((entry) => entry.version === wanted)?.createdAt ??
      artifact.updatedAt,
    content: { ...content, summary: content.summary ?? null },
    versions,
  };
}

/** Saves an earlier version again as the newest; history keeps both. */
export async function restoreArtifactVersion(params: {
  organizationId: string;
  artifactId: string;
  version: number;
  userId: string;
}) {
  const artifact = await findArtifact(params.organizationId, params.artifactId);
  if (!artifact) {
    throw new ArtifactNotFoundError();
  }
  const file = await readArtifactVersionFile(
    params.organizationId,
    params.artifactId,
    params.version
  );
  const content = file ? parseArtifactFile(file).content : null;
  if (!content) {
    throw new ArtifactNotFoundError();
  }
  return updateArtifact(
    {
      organizationId: params.organizationId,
      userId: params.userId,
      source: artifact.source as ArtifactWriter["source"],
      actor: "member",
    },
    params.artifactId,
    content,
    artifact.currentVersion
  );
}

/** What the get tool hands the model: the current file and its version. */
export async function readArtifactForModel(
  organizationId: string,
  artifactId: string
) {
  const row = await db.query.artifacts.findFirst({
    columns: { currentVersion: true, content: true },
    where: artifactWhere(organizationId, artifactId),
  });
  if (!row) {
    throw new ArtifactNotFoundError();
  }
  return {
    artifactId,
    version: row.currentVersion,
    content: artifactFile(row.content),
  };
}

/** The workspace's artifacts, newest change first, for the agent to find one again. */
export async function listArtifacts(
  organizationId: string,
  options: { query?: string; limit?: number } = {}
) {
  const query = options.query?.trim();
  const rows = await db
    .select({
      id: artifacts.id,
      title: artifacts.title,
      summary: sql<string | null>`${artifacts.content}->>'summary'`,
      source: artifacts.source,
      version: artifacts.currentVersion,
      updatedAt: artifacts.updatedAt,
    })
    .from(artifacts)
    .where(
      and(
        eq(artifacts.organizationId, organizationId),
        artifactHasRepo(),
        query
          ? ilike(artifacts.title, `%${query.replace(/[%_\\]/g, "\\$&")}%`)
          : undefined
      )
    )
    .orderBy(desc(artifacts.updatedAt))
    .limit(options.limit ?? ARTIFACT_LIMITS.listed);
  return rows.map((row) => ({ ...row, url: artifactUrl(row.id) }));
}

/** The version of a publicly shared artifact its link was published at. */
export async function readSharedArtifact(shareId: string) {
  const [row] = await db
    .select({
      organizationId: artifacts.organizationId,
      source: artifacts.source,
      version: artifacts.shareVersion,
      content: artifacts.shareContent,
      updatedAt: artifactRevisions.createdAt,
    })
    .from(artifacts)
    .innerJoin(
      artifactRevisions,
      and(
        eq(artifactRevisions.artifactId, artifacts.id),
        eq(artifactRevisions.version, artifacts.shareVersion)
      )
    )
    .where(and(eq(artifacts.shareId, shareId), artifactHasRepo()))
    .limit(1);
  if (!(row?.content && row.version)) {
    return null;
  }
  return {
    ...row,
    version: row.version,
    content: parseArtifactContent(row.content),
  };
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
