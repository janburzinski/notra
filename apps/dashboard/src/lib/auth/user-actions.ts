import { db } from "@notra/db/drizzle";
import { socialConnections, users } from "@notra/db/schema";
import { deleteBrewContact } from "@notra/email/utils/brew";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  signOutOptionsSchema,
  unlinkAccountInputSchema,
  updateUserInputSchema,
} from "@notra/schemas/dashboard/auth/user-actions";
import { isDemoMode } from "@notra/utils/demo-mode";
import { getWorkOS } from "@workos/authkit-session";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { DEMO_EXIT_URL, DEMO_SESSION_COOKIE } from "@/constants/demo";
import {
  ActionFailure,
  failDemoDisabled,
  tryAction,
} from "@/lib/actions/errors";
import { runAction } from "@/lib/actions/run-action";
import { validateActionInput } from "@/lib/actions/validate-input";
import { runAfterResponse } from "@/lib/after-response";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { readRequestHeaders } from "@/lib/analytics/request-headers";
import { deleteAccount } from "@/lib/auth/delete-account";
import { ownsWorkspace } from "@/lib/auth/delete-user-record";
import { getAuthIdentity } from "@/lib/auth/server";
import { clearAuthSessionCookie } from "@/lib/auth/session-cookie";
import { clearSignedCookie } from "@/lib/auth/signed-cookie";
import { signOutAuthSession } from "@/lib/auth/workos";
import { syncBrewContacts } from "@/lib/email/brew-contacts";
import { clearLocaleCookie, writeLocaleCookie } from "@/lib/i18n/locale-cookie";
import { failWithOrganizationMessage } from "@/lib/organizations/action-messages";
import { requireSession } from "@/lib/organizations/guards";
import { revokeSitePreviewSessions } from "@/lib/sites/preview-revocation";
import type { SessionUser } from "@/types/auth/session";
import type {
  SignOutActionOptions,
  UnlinkAccountInput,
  UpdateUserInput,
} from "@/types/auth/user-actions";
import type { AccountInfo, ActionResult } from "@/types/organizations/actions";

const NAME_SPLIT_REGEX = /\s+/;

export async function signOut(options?: SignOutActionOptions) {
  const parsed = signOutOptionsSchema.safeParse(options);
  await clearLocaleCookie();
  if (isDemoMode()) {
    await clearSignedCookie(DEMO_SESSION_COOKIE);
    return DEMO_EXIT_URL;
  }
  const [destination] = await Promise.all([
    signOutAuthSession(parsed.success ? parsed.data : undefined),
    (async () => {
      const identity = await getAuthIdentity().catch(() => null);
      if (identity) {
        await revokeSitePreviewSessions(identity.user.id);
      }
    })(),
  ]);
  return destination;
}

export async function updateUser(
  rawInput: UpdateUserInput
): Promise<ActionResult<SessionUser>> {
  return runAction(
    Effect.gen(function* () {
      const session = yield* requireSession();
      const input = yield* validateActionInput(updateUserInputSchema, rawInput);

      const updates: Partial<{
        name: string;
        image: string | null;
        hidePersonalData: boolean;
        showAgentStats: boolean;
        locale: string | null;
      }> = {};

      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.image !== undefined) {
        updates.image = input.image;
      }
      if (input.hidePersonalData !== undefined) {
        updates.hidePersonalData = input.hidePersonalData;
      }
      if (input.showAgentStats !== undefined) {
        updates.showAgentStats = input.showAgentStats;
      }
      if (input.locale !== undefined) {
        updates.locale = input.locale;
      }

      const [updated] = yield* tryAction(
        () =>
          db
            .update(users)
            .set(updates)
            .where(eq(users.id, session.user.id))
            .returning(),
        "Failed to update user"
      );

      if (!updated) {
        return yield* failWithOrganizationMessage(
          "actions.organizations.userNotFound"
        );
      }

      if (input.locale !== undefined) {
        const locale = input.locale;
        yield* Effect.promise(() => writeLocaleCookie(locale));
      }

      if (input.name !== undefined) {
        yield* Effect.sync(() =>
          runAfterResponse("[BrewContacts] Sync failed", () =>
            syncBrewContacts([updated.id])
          )
        );
      }

      if (input.name !== undefined && updated.workosUserId) {
        const [firstName, ...rest] = input.name.split(NAME_SPLIT_REGEX);
        yield* tryAction(
          () =>
            getWorkOS().userManagement.updateUser({
              userId: updated.workosUserId ?? "",
              firstName,
              lastName: rest.join(" ") || undefined,
            }),
          "Failed to sync user profile"
        ).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Could not sync user profile to WorkOS").pipe(
              Effect.annotateLogs({ userId: updated.id, error: error.message })
            )
          )
        );
      }

      return updated;
    })
  );
}

export async function deleteUser(): Promise<
  ActionResult<{ deleted: boolean }>
> {
  return runAction(
    Effect.gen(function* () {
      if (isDemoMode()) {
        return yield* failDemoDisabled;
      }
      const session = yield* requireSession();

      const ownsAnOrganization = yield* tryAction(
        () => ownsWorkspace(session.user.id),
        "Failed to check workspace ownership"
      );
      if (ownsAnOrganization) {
        return yield* Effect.fail(
          new ActionFailure({
            message:
              "Transfer or delete your workspaces before deleting your account.",
          })
        );
      }

      // A Brew outage stops the deletion here instead of leaving the contact
      // behind; `finishUserDeletion` removes it again once the account is gone.
      yield* tryAction(
        () => deleteBrewContact(session.user.email),
        "Failed to delete email contact"
      );

      yield* deleteAccount({
        userId: session.user.id,
        email: session.user.email,
        workosUserId: session.user.workosUserId,
      });

      const requestHeaders = yield* Effect.promise(readRequestHeaders);
      yield* Effect.sync(() => {
        trackServerEvent({
          event: POSTHOG_EVENTS.ACCOUNT_DELETED,
          headers: requestHeaders,
          userId: session.user.id,
          properties: { had_paid_history: null },
        });
      });

      yield* tryAction(clearAuthSessionCookie, "Failed to clear session");
      yield* Effect.promise(clearLocaleCookie);

      return { deleted: true };
    })
  );
}

export async function requestPasswordReset(): Promise<
  ActionResult<{ sent: boolean }>
> {
  return runAction(
    Effect.gen(function* () {
      if (isDemoMode()) {
        return yield* failDemoDisabled;
      }
      const session = yield* requireSession();

      yield* tryAction(
        () =>
          getWorkOS().userManagement.createPasswordReset({
            email: session.user.email,
          }),
        "Failed to create password reset"
      );

      return { sent: true };
    })
  );
}

export async function listAccounts(): Promise<ActionResult<AccountInfo[]>> {
  return runAction(
    Effect.gen(function* () {
      const session = yield* requireSession();

      const rows = yield* tryAction(
        () =>
          db.query.socialConnections.findMany({
            where: eq(socialConnections.userId, session.user.id),
          }),
        "Failed to list connected accounts"
      );

      return rows.map((row) => ({
        id: row.id,
        providerId: row.provider,
        accountId: row.providerAccountId,
        scopes: row.scope?.split(" ").filter(Boolean) ?? [],
        createdAt: row.createdAt,
      }));
    })
  );
}

export async function unlinkAccount(
  rawInput: UnlinkAccountInput
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(
    Effect.gen(function* () {
      const session = yield* requireSession();
      const input = yield* validateActionInput(
        unlinkAccountInputSchema,
        rawInput
      );

      yield* tryAction(
        () =>
          db
            .delete(socialConnections)
            .where(
              and(
                eq(socialConnections.userId, session.user.id),
                eq(socialConnections.provider, input.providerId)
              )
            ),
        "Failed to unlink account"
      );

      return { removed: true };
    })
  );
}
