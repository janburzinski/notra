import { getWorkOS } from "@workos/authkit-session";
import { Effect } from "effect";

import { ActionFailure, tryAction } from "@/lib/actions/errors";
import {
  clearAccountDeletion,
  markAccountDeletion,
} from "@/lib/auth/account-deletion-marker";
import {
  deleteDeletedUserFiles,
  deleteUserRows,
} from "@/lib/auth/delete-user-record";
import { finishUserDeletion } from "@/lib/auth/finish-user-deletion";
import { isWorkOSNotFound } from "@/lib/auth/workos-error";

const revokeAllSessions = (workosUserId: string) =>
  tryAction(async () => {
    const userManagement = getWorkOS().userManagement;
    const sessions = await (
      await userManagement.listSessions(workosUserId)
    ).autoPagination();
    await Promise.all(
      sessions.map((session) =>
        userManagement.revokeSession({ sessionId: session.id })
      )
    );
  }, "Failed to revoke WorkOS sessions").pipe(
    // The deletion marker still stops these sessions recreating the account.
    Effect.catch((error) =>
      Effect.logWarning("Could not revoke WorkOS sessions").pipe(
        Effect.annotateLogs({ workosUserId, error: error.message })
      )
    )
  );

const deleteWorkOSUser = (workosUserId: string) =>
  tryAction(
    () => getWorkOS().userManagement.deleteUser(workosUserId),
    "Failed to delete WorkOS user"
  ).pipe(
    Effect.catch((error) =>
      isWorkOSNotFound(error.cause)
        ? Effect.logWarning("WorkOS user was already deleted").pipe(
            Effect.annotateLogs({ workosUserId })
          )
        : Effect.fail(error)
    ),
    // Signing in again recreates an empty local account, so the user can retry.
    Effect.tapError(() =>
      Effect.promise(() =>
        clearAccountDeletion(workosUserId).catch(() => undefined)
      )
    )
  );

/**
 * Deletes a user's local account, WorkOS user and files, in that order:
 * 1. A deletion marker stops other sessions recreating the local account
 *    (`ensureLocalUser`) until the WorkOS user is gone. If Redis is configured
 *    but the marker can't be set, the deletion doesn't start; without Redis
 *    it runs unmarked.
 * 2. Every WorkOS session is revoked.
 * 3. The local rows go, then `finishUserDeletion`. If this fails the WorkOS
 *    user still exists, so the user can sign in and retry.
 * 4. The WorkOS user goes. If this fails the marker is cleared so the user can
 *    sign in again and retry.
 * 5. The R2 objects go, whether or not step 4 worked: their rows are gone.
 */
export const deleteAccount = Effect.fn("auth.deleteAccount")(function* ({
  userId,
  email,
  workosUserId,
}: {
  userId: string;
  email: string;
  workosUserId: string | null;
}) {
  if (workosUserId) {
    const marker = yield* Effect.promise(() =>
      markAccountDeletion(workosUserId)
    );
    if (marker === "unconfigured") {
      // Self-hosting and local dev: deleting must still work, only the
      // protection against other sessions recreating the account is lost.
      yield* Effect.logWarning(
        "Redis isn't configured; deleting the account without a deletion marker"
      ).pipe(Effect.annotateLogs({ userId, workosUserId }));
    }
    if (marker === "failed") {
      return yield* Effect.fail(
        new ActionFailure({
          message:
            "Account deletion is unavailable right now. Try again in a few minutes.",
        })
      );
    }
    yield* revokeAllSessions(workosUserId);
  }

  const chatAttachmentKeys = yield* tryAction(
    () => deleteUserRows(userId),
    "Failed to delete user"
  );
  if (chatAttachmentKeys === null) {
    if (workosUserId) {
      yield* tryAction(
        () => clearAccountDeletion(workosUserId),
        "Failed to clear account deletion marker"
      ).pipe(
        Effect.catch((error) =>
          Effect.logWarning("Could not clear account deletion marker").pipe(
            Effect.annotateLogs({ userId, workosUserId, error: error.message })
          )
        )
      );
    }
    return yield* Effect.fail(
      new ActionFailure({
        message:
          "Transfer or delete your workspaces before deleting your account.",
      })
    );
  }
  yield* Effect.sync(() => finishUserDeletion({ userId, email }));

  yield* (workosUserId ? deleteWorkOSUser(workosUserId) : Effect.void).pipe(
    Effect.ensuring(
      Effect.promise(() => deleteDeletedUserFiles(userId, chatAttachmentKeys))
    )
  );
});
