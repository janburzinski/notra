import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "@notra/db/drizzle";
import { chatAttachments, users } from "@notra/db/schema";
import { and, desc, eq, inArray, lt, notInArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";
import { authorizedProcedure } from "@/lib/orpc/base";
import { getR2Config, getR2PublicUrl } from "@/lib/upload/r2";

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};

function inferMediaTypeFromKey(key: string): string {
  const lastDot = key.lastIndexOf(".");
  if (lastDot === -1) {
    return "application/octet-stream";
  }
  const ext = key.slice(lastDot + 1).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? "application/octet-stream";
}

function deriveFilenameFromKey(key: string): string {
  const lastSlash = key.lastIndexOf("/");
  return lastSlash === -1 ? key : key.slice(lastSlash + 1);
}

// One-time migration from pre-table R2 objects. Only runs when the user has
// zero DB rows — prevents expensive R2 ListObjectsV2 pagination on every
// attachment page-load for established users.
async function backfillFromR2(userId: string) {
  const { client, bucketName } = getR2Config();
  const prefix = `user/${userId}/chat/`;

  const [existing] = await db
    .select({ count: chatAttachments.id })
    .from(chatAttachments)
    .where(eq(chatAttachments.userId, userId))
    .limit(1);
  if (existing) {
    return;
  }

  let continuationToken: string | undefined;
  const now = new Date();
  const newRows: {
    id: string;
    userId: string;
    key: string;
    filename: string;
    mediaType: string;
    size: number;
    createdAt: Date;
  }[] = [];

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key) {
        continue;
      }
      newRows.push({
        id: nanoid(),
        userId,
        key: object.Key,
        filename: deriveFilenameFromKey(object.Key),
        mediaType: inferMediaTypeFromKey(object.Key),
        size: object.Size ?? 0,
        // Backfill uses current time so retention doesn't immediately nuke
        // legacy objects whose R2 LastModified predates the retention window.
        createdAt: now,
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  if (newRows.length > 0) {
    await db
      .insert(chatAttachments)
      .values(newRows)
      .onConflictDoNothing({ target: chatAttachments.key });
  }
}

const TRAILING_SLASH_REGEX = /\/$/;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
] as const;
const TEXT_MIME_TYPES = ["text/plain", "text/markdown"] as const;
const KNOWN_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  ...TEXT_MIME_TYPES,
] as const;

const ATTACHMENT_FILTER = ["all", "image", "pdf", "text", "other"] as const;
type AttachmentFilter = (typeof ATTACHMENT_FILTER)[number];

const LIST_PAGE_SIZE = 100;

const listInputSchema = z.object({
  filter: z.enum(ATTACHMENT_FILTER).default("all"),
  cursor: z
    .object({
      createdAt: z.string().datetime(),
      id: z.string(),
    })
    .optional(),
});

const deleteManyInputSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(500),
});

const setRetentionInputSchema = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]),
});

function buildFilterCondition(userId: string, filter: AttachmentFilter) {
  const userCondition = eq(chatAttachments.userId, userId);

  if (filter === "image") {
    return and(
      userCondition,
      inArray(chatAttachments.mediaType, [...IMAGE_MIME_TYPES])
    );
  }
  if (filter === "pdf") {
    return and(userCondition, eq(chatAttachments.mediaType, "application/pdf"));
  }
  if (filter === "text") {
    return and(
      userCondition,
      inArray(chatAttachments.mediaType, [...TEXT_MIME_TYPES])
    );
  }
  if (filter === "other") {
    return and(
      userCondition,
      notInArray(chatAttachments.mediaType, [...KNOWN_MIME_TYPES])
    );
  }
  return userCondition;
}

async function deleteR2Keys(keys: string[]) {
  if (keys.length === 0) {
    return;
  }
  const { client, bucketName } = getR2Config();
  const MAX = 1000;
  for (let i = 0; i < keys.length; i += MAX) {
    const chunk = keys.slice(i, i + MAX);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  }
}

async function applyRetention(userId: string, retentionDays: number | null) {
  if (retentionDays == null) {
    return;
  }
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expired = await db
    .select({ key: chatAttachments.key })
    .from(chatAttachments)
    .where(
      and(
        eq(chatAttachments.userId, userId),
        lt(chatAttachments.createdAt, cutoff)
      )
    );

  if (expired.length === 0) {
    return;
  }
  const keys = expired.map((row) => row.key);
  await db
    .delete(chatAttachments)
    .where(
      and(
        eq(chatAttachments.userId, userId),
        inArray(chatAttachments.key, keys)
      )
    );
  await deleteR2Keys(keys);
}

function buildPublicUrl(key: string) {
  const base = getR2PublicUrl().replace(TRAILING_SLASH_REGEX, "");
  return `${base}/${key}`;
}

export const attachmentsRouter = {
  list: authorizedProcedure
    .input(listInputSchema)
    .handler(async ({ context, input }) => {
      const [userRow] = await db
        .select({
          retentionDays: users.chatAttachmentRetentionDays,
        })
        .from(users)
        .where(eq(users.id, context.user.id))
        .limit(1);

      if (!input.cursor) {
        await backfillFromR2(context.user.id);
        await applyRetention(context.user.id, userRow?.retentionDays ?? null);
      }

      const filterCondition = buildFilterCondition(
        context.user.id,
        input.filter
      );
      const cursorCondition = input.cursor
        ? or(
            lt(chatAttachments.createdAt, new Date(input.cursor.createdAt)),
            and(
              eq(chatAttachments.createdAt, new Date(input.cursor.createdAt)),
              lt(chatAttachments.id, input.cursor.id)
            )
          )
        : undefined;

      const rows = await db
        .select()
        .from(chatAttachments)
        .where(
          cursorCondition
            ? and(filterCondition, cursorCondition)
            : filterCondition
        )
        .orderBy(desc(chatAttachments.createdAt), desc(chatAttachments.id))
        .limit(LIST_PAGE_SIZE + 1);

      const hasMore = rows.length > LIST_PAGE_SIZE;
      const page = hasMore ? rows.slice(0, LIST_PAGE_SIZE) : rows;
      const lastRow = page.at(-1);
      const nextCursor =
        hasMore && lastRow
          ? { createdAt: lastRow.createdAt.toISOString(), id: lastRow.id }
          : null;

      return {
        attachments: page.map((row) => ({
          id: row.id,
          key: row.key,
          filename: row.filename,
          mediaType: row.mediaType,
          size: row.size,
          createdAt: row.createdAt,
          url: buildPublicUrl(row.key),
        })),
        nextCursor,
        retentionDays: userRow?.retentionDays ?? null,
      };
    }),
  deleteMany: authorizedProcedure
    .input(deleteManyInputSchema)
    .handler(async ({ context, input }) => {
      // Authorize via DB ownership, not key prefix. Only rows that actually
      // belong to the caller get deleted from R2.
      const owned = await db
        .select({ key: chatAttachments.key })
        .from(chatAttachments)
        .where(
          and(
            eq(chatAttachments.userId, context.user.id),
            inArray(chatAttachments.key, input.keys)
          )
        );

      const ownedKeys = owned.map((row) => row.key);
      if (ownedKeys.length === 0) {
        return { success: true, deleted: 0 };
      }

      await db
        .delete(chatAttachments)
        .where(
          and(
            eq(chatAttachments.userId, context.user.id),
            inArray(chatAttachments.key, ownedKeys)
          )
        );
      await deleteR2Keys(ownedKeys);

      return { success: true, deleted: ownedKeys.length };
    }),
  runRetention: authorizedProcedure.handler(async ({ context }) => {
    const [row] = await db
      .select({ retentionDays: users.chatAttachmentRetentionDays })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    await applyRetention(context.user.id, row?.retentionDays ?? null);
    return { success: true };
  }),
  getRetention: authorizedProcedure.handler(async ({ context }) => {
    const [row] = await db
      .select({ retentionDays: users.chatAttachmentRetentionDays })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    return { retentionDays: row?.retentionDays ?? null };
  }),
  setRetention: authorizedProcedure
    .input(setRetentionInputSchema)
    .handler(async ({ context, input }) => {
      // DB writes (settings update + row deletion) run inside a transaction so
      // a failure mid-way doesn't leave the user row updated but rows still
      // present. R2 object deletion happens after commit — if R2 fails, the DB
      // already reflects the user's intent and the orphans get cleaned up on
      // the next retention pass.
      const expiredKeys = await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ chatAttachmentRetentionDays: input.days })
          .where(eq(users.id, context.user.id));

        if (input.days == null) {
          return [] as string[];
        }
        const cutoff = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
        const expired = await tx
          .select({ key: chatAttachments.key })
          .from(chatAttachments)
          .where(
            and(
              eq(chatAttachments.userId, context.user.id),
              lt(chatAttachments.createdAt, cutoff)
            )
          );
        if (expired.length === 0) {
          return [];
        }
        const keys = expired.map((row) => row.key);
        await tx
          .delete(chatAttachments)
          .where(
            and(
              eq(chatAttachments.userId, context.user.id),
              inArray(chatAttachments.key, keys)
            )
          );
        return keys;
      });

      if (expiredKeys.length > 0) {
        await deleteR2Keys(expiredKeys);
      }

      return { retentionDays: input.days };
    }),
};
