import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  abuseActions,
  chatAttachments,
  chatSessions,
  members,
  users,
} from "@notra/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  deleteUserChatAttachmentObjects,
  deleteUserFiles,
} from "@/lib/upload/cleanup";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const DELETE_USER_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 50;
// Deadlock and serialization failures: Postgres rolled the transaction back,
// so running it again is safe.
const RETRYABLE_SQLSTATES = new Set(["40P01", "40001"]);

/**
 * A reused upload has one row, owned by whoever uploaded it first. When
 * another current member of the workspace sent the same file, the row moves to
 * the earliest such author instead of cascading, so their copy is kept.
 * Messages without `authorUserId` can't be attributed. Each workspace's chat
 * history is expanded once, then matched to the user's keys.
 */
function sharedChatAttachmentHeirs(userId: string) {
  const asArray = (value: ReturnType<typeof sql>) =>
    sql`case when jsonb_typeof(${value}) = 'array' then ${value} else '[]'::jsonb end`;
  return sql`
    with workspaces as (
      select distinct organization_id
      from ${chatAttachments}
      where user_id = ${userId}
    ),
    sent_files as (
      select
        session.organization_id,
        substring(part.value ->> 'url' from '(organization/[^/]+/chat/[^/?#]+)$') as key,
        message.value -> 'metadata' ->> 'authorUserId' as author_id,
        session.created_at,
        session.id as session_id,
        message.position
      from ${chatSessions} as session
      join workspaces on workspaces.organization_id = session.organization_id
      cross join lateral jsonb_array_elements(${asArray(sql`session.messages`)})
        with ordinality as message(value, position)
      cross join lateral jsonb_array_elements(${asArray(sql`message.value -> 'parts'`)})
        as part(value)
      where session.deleted_at is null
        and message.value ->> 'role' = 'user'
        and part.value ->> 'type' = 'file'
        and message.value -> 'metadata' ->> 'authorUserId' <> ${userId}
    )
    select distinct on (owned.id) owned.id, sent.author_id
    from ${chatAttachments} as owned
    join sent_files as sent
      on sent.organization_id = owned.organization_id
      and sent.key = owned.key
    join ${members} as member
      on member.organization_id = owned.organization_id
      and member.user_id = sent.author_id
    where owned.user_id = ${userId}
    order by owned.id, sent.created_at, sent.session_id, sent.position
  `;
}

/**
 * Locks the user and every member a file may be handed to in one statement,
 * ascending by id. Two members deleting their accounts at once then queue on
 * the first shared row instead of each holding its own row while the
 * hand-over waits for the other's.
 */
async function lockUsersInvolved(tx: Transaction, userId: string) {
  const heirs = await tx.execute<{ author_id: string }>(
    sharedChatAttachmentHeirs(userId)
  );
  const userIds = [
    ...new Set([userId, ...heirs.rows.map((row) => row.author_id)]),
  ];
  await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds))
    .orderBy(users.id)
    .for("update");
}

function isRetryableTransactionError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Object; depth += 1) {
    if (RETRYABLE_SQLSTATES.has(String((current as { code?: unknown }).code))) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Thrown inside the transaction to roll it back when an owner is kept. */
class WorkspaceOwnerKept extends Error {}

async function deleteUserRowsOnce(
  userId: string,
  keepWorkspaceOwners: boolean
) {
  return await db.transaction(async (tx) => {
    // The user lock also blocks their new attachment rows until they're gone.
    await lockUsersInvolved(tx, userId);
    await tx.execute(sql`
      update ${chatAttachments} as attachment
      set user_id = heir.author_id
      from (${sharedChatAttachmentHeirs(userId)}) as heir
      where attachment.id = heir.id
    `);
    const attachments = await tx
      .select({ key: chatAttachments.key })
      .from(chatAttachments)
      .where(eq(chatAttachments.userId, userId));
    // Moderation records about the account go with it; its id can't
    // match a new sign-up, so keeping them would protect nothing.
    await tx
      .delete(abuseActions)
      .where(
        and(
          eq(abuseActions.subjectType, "user"),
          eq(abuseActions.subjectId, userId)
        )
      );
    if (keepWorkspaceOwners) {
      // Locking every membership row waits for a concurrent ownership
      // transfer to commit, then sees its result. Filtering by role here
      // would skip a row that is only becoming the owner.
      const memberships = await tx
        .select({ role: members.role })
        .from(members)
        .where(eq(members.userId, userId))
        .orderBy(members.id)
        .for("update");
      if (memberships.some((membership) => membership.role === "owner")) {
        throw new WorkspaceOwnerKept();
      }
    }
    await tx.delete(users).where(eq(users.id, userId));
    return attachments.map((row) => row.key);
  });
}

async function deleteUserRowsWithRetry(
  userId: string,
  keepWorkspaceOwners: boolean
): Promise<string[] | null> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each retry needs the previous attempt to have rolled back
      return await deleteUserRowsOnce(userId, keepWorkspaceOwners);
    } catch (error) {
      if (error instanceof WorkspaceOwnerKept) {
        return null;
      }
      if (
        attempt >= DELETE_USER_ATTEMPTS ||
        !isRetryableTransactionError(error)
      ) {
        throw error;
      }
      // Jitter so the transaction that lost doesn't collide again in lockstep.
      const backoffMs = RETRY_BACKOFF_MS * attempt * (1 + Math.random());
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- the backoff must finish before the next attempt
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Deletes the user row; every chat attachment they uploaded, in every
 * workspace, cascades with it, except files another member also sent (see
 * `sharedChatAttachmentHeirs`). Returns the R2 keys read in the same
 * transaction, for `deleteDeletedUserFiles` once the account is gone.
 */
export async function deleteUserRows(userId: string) {
  return (await deleteUserRowsWithRetry(userId, false)) ?? [];
}

/** Skips keys a re-upload of the same file recorded again since the commit. */
async function keysWithoutRows(keys: string[]) {
  if (keys.length === 0) {
    return keys;
  }
  const recorded = await db
    .select({ key: chatAttachments.key })
    .from(chatAttachments)
    .where(inArray(chatAttachments.key, keys));
  const recordedKeys = new Set(recorded.map((row) => row.key));
  return keys.filter((key) => !recordedKeys.has(key));
}

/**
 * Removes the R2 objects of a deleted user: their chat attachments and
 * everything under `user/<id>/`. Runs only after the rows are committed away,
 * so a failed deletion never leaves rows pointing at missing files. Never
 * throws: failures are logged with the keys.
 */
export async function deleteDeletedUserFiles(
  userId: string,
  chatAttachmentKeys: string[]
) {
  await Promise.all([
    keysWithoutRows(chatAttachmentKeys).then(
      (keys) => deleteUserChatAttachmentObjects(userId, keys),
      (error) => {
        // Without the re-check a re-uploaded file could go, so keep them all.
        logError("[Delete User] Failed to re-check chat attachments", error, {
          userId,
          keys: chatAttachmentKeys,
        });
      }
    ),
    // Already logged; the account is gone either way.
    deleteUserFiles(userId).catch(() => undefined),
  ]);
}

/**
 * Deletes the user's rows, then their files. With `keepWorkspaceOwners`, a
 * user who owns a workspace when the transaction checks (under the lock) is
 * left alone and false is returned.
 */
export async function deleteUserRecord(
  userId: string,
  { keepWorkspaceOwners = false }: { keepWorkspaceOwners?: boolean } = {}
) {
  const keys = await deleteUserRowsWithRetry(userId, keepWorkspaceOwners);
  if (!keys) {
    return false;
  }
  await deleteDeletedUserFiles(userId, keys);
  return true;
}
