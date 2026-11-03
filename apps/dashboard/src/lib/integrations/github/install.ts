"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { buildCallbackUrl } from "@notra/utils/callback-url";
import { ORPCError } from "@orpc/client";
import { Effect } from "effect";

import { INTEGRATION_PROVIDERS } from "@/constants/integration-analytics";
import { flushTrackEvent } from "@/lib/analytics/posthog-client";
import { startSocialSignInAction } from "@/lib/auth/social-actions";
import { dashboardOrpc } from "@/lib/orpc/query";

import {
  GitHubAccountConnectionIncompleteError,
  GitHubInstallCancelledError,
  GitHubInstallStartError,
  type StartGitHubInstallResult,
} from "../../../types/integrations/github";
import { chooseGitHubInstallation } from "./installation-picker";

/** Links an installation the user already administers, then lands where a fresh install would. */
async function linkInstallation(params: {
  organizationId: string;
  callbackPath: string;
  installationId: string;
}) {
  const { accountId } = await dashboardOrpc.github.app.linkInstallation.call({
    organizationId: params.organizationId,
    installationId: params.installationId,
  });
  window.location.assign(
    buildCallbackUrl("", params.callbackPath, {
      githubConnected: "true",
      githubAccountId: accountId,
    })
  );
}

function authorizeGitHub(callbackURL: string) {
  return Effect.tryPromise({
    try: async () => {
      await startSocialSignInAction({
        provider: "github",
        returnTo: callbackURL,
      });
      return true;
    },
    catch: (cause) => new GitHubInstallStartError({ cause }),
  });
}

export function reauthorizeGitHub(callbackURL: string) {
  return Effect.runPromise(
    authorizeGitHub(callbackURL).pipe(
      Effect.match({
        onFailure: () => false,
        onSuccess: () => true,
      })
    )
  );
}

function reauthorizationAttemptKey(state: string) {
  return `notra:github-reauthorize-attempted:${state}`;
}

export function hasAttemptedGitHubReauthorization(state: string) {
  return (
    window.sessionStorage.getItem(reauthorizationAttemptKey(state)) !== null
  );
}

export function markGitHubReauthorizationAttempted(state: string) {
  window.sessionStorage.setItem(reauthorizationAttemptKey(state), "true");
}

export async function startGitHubInstall(params: {
  organizationId: string;
  callbackPath: string;
  allowAccountConnection?: boolean;
  /** Close the caller's own dialog so the account picker is not stacked on it. */
  onPickerOpen?: () => void;
}): Promise<StartGitHubInstallResult> {
  const allowAccountConnection = params.allowAccountConnection ?? true;

  await flushTrackEvent(POSTHOG_EVENTS.INTEGRATION_CONNECT_STARTED, {
    provider: INTEGRATION_PROVIDERS.GITHUB,
    allow_account_connection: allowAccountConnection,
  });

  return Effect.runPromise(
    Effect.tryPromise({
      try: () =>
        dashboardOrpc.github.app.prepareInstallUrl.call({
          organizationId: params.organizationId,
          callbackPath: params.callbackPath,
        }),
      catch: (cause) => new GitHubInstallStartError({ cause }),
    }).pipe(
      Effect.flatMap(
        (
          preparedInstall
        ): Effect.Effect<
          boolean,
          | GitHubInstallStartError
          | GitHubAccountConnectionIncompleteError
          | GitHubInstallCancelledError
        > => {
          if (preparedInstall.requiresAccountConnection) {
            if (!allowAccountConnection) {
              return Effect.fail(
                new GitHubAccountConnectionIncompleteError({
                  callbackPath: params.callbackPath,
                })
              );
            }

            const callbackUrl = new URL(
              params.callbackPath,
              window.location.origin
            );
            callbackUrl.searchParams.set("githubAccountConnected", "true");

            return authorizeGitHub(
              `${callbackUrl.pathname}${callbackUrl.search}`
            );
          }

          const { url, linkable } = preparedInstall;
          if (linkable.length === 0) {
            return Effect.sync(() => {
              window.location.assign(url);
              return true;
            });
          }

          params.onPickerOpen?.();
          return Effect.promise(() =>
            chooseGitHubInstallation({
              installations: linkable,
              connect: (installationId) =>
                linkInstallation({ ...params, installationId }),
            })
          ).pipe(
            Effect.flatMap((choice) => {
              if (choice === null) {
                return Effect.fail(new GitHubInstallCancelledError());
              }
              if (choice === "new") {
                window.location.assign(url);
              }
              return Effect.succeed(true);
            })
          );
        }
      ),
      Effect.match({
        onFailure: (error): StartGitHubInstallResult => {
          if (error._tag === "GitHubAccountConnectionIncompleteError") {
            return { started: false, reason: "account-connection-incomplete" };
          }
          if (error._tag === "GitHubInstallCancelledError") {
            return { started: false, reason: "cancelled" };
          }
          const { cause } = error;
          const isForbidden =
            cause instanceof ORPCError && cause.code === "FORBIDDEN";
          return {
            started: false,
            reason: "install-start-failed",
            ...(isForbidden ? { message: cause.message } : {}),
          };
        },
        onSuccess: (): StartGitHubInstallResult => ({ started: true }),
      })
    )
  );
}
