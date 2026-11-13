import { setTimeout as sleep } from "node:timers/promises";

import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { linearIntegrations } from "@notra/db/schema";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import {
  decryptToken,
  encryptToken,
} from "@notra/db/utils/integration-encryption";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import {
  LINEAR_ACCESS_TOKEN_REFRESH_BUFFER_MS,
  LINEAR_DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  LINEAR_OAUTH_TOKEN_URL,
  LINEAR_SCHEDULED_REFRESH_BUDGET_MS,
  LINEAR_SCHEDULED_REFRESH_CONCURRENCY,
  LINEAR_SCHEDULED_REFRESH_WINDOW_MS,
  LINEAR_TOKEN_REFRESH_MAX_ATTEMPTS,
  LINEAR_TOKEN_REFRESH_RETRY_DELAY_MS,
  LINEAR_TOKEN_REQUEST_TIMEOUT_MS,
} from "../constants/linear";
import {
  linearTokenErrorSchema,
  linearTokenResponseSchema,
} from "../schemas/linear-oauth";
import type { ConnectLinearIntegrationParams } from "../types/integrations";
import type {
  LinearOAuthCredentials,
  LinearOAuthTokens,
  LinearTokenRefreshSummary,
  LinearTokenRequestResult,
} from "../types/linear-oauth";
import { hasOrganizationAccess } from "../utils/organization-access";
import {
  LinearOAuthNotConfiguredError,
  LinearReconnectRequiredError,
  LinearTokenRequestError,
} from "./linear-oauth-errors";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

const tokenColumns = {
  id: linearIntegrations.id,
  organizationId: linearIntegrations.organizationId,
  linearOrganizationId: linearIntegrations.linearOrganizationId,
  encryptedAccessToken: linearIntegrations.encryptedAccessToken,
  encryptedRefreshToken: linearIntegrations.encryptedRefreshToken,
  accessTokenExpiresAt: linearIntegrations.accessTokenExpiresAt,
};

type LinearTokenFields = Pick<
  typeof linearIntegrations.$inferSelect,
  "id" | "encryptedAccessToken" | "accessTokenExpiresAt"
>;

export function getLinearOAuthCredentials(): LinearOAuthCredentials | null {
  const clientId = process.env.LINEAR_CLIENT_ID?.trim();
  const clientSecret = process.env.LINEAR_CLIENT_SECRET?.trim();
  if (!(clientId && clientSecret)) {
    return null;
  }
  return { clientId, clientSecret };
}

// Rows of one Notra organization that point at the same Linear workspace share
// one authorization, so connects and refreshes for them are serialized.
function linearAuthorizationLockKey(
  organizationId: string,
  linearOrganizationId: string
): string {
  return `linear-oauth:${organizationId}:${linearOrganizationId}`;
}

function isLinearAccessTokenDue(
  expiresAt: Date | null,
  windowMs: number
): boolean {
  return expiresAt !== null && expiresAt.getTime() - windowMs <= Date.now();
}

async function requestLinearToken(
  grant: Record<string, string>,
  credentials: LinearOAuthCredentials
): Promise<LinearTokenRequestResult> {
  const response = await fetch(LINEAR_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...grant,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
    signal: AbortSignal.timeout(LINEAR_TOKEN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = linearTokenErrorSchema.safeParse(
      await response.json().catch(() => null)
    );
    if (error.success && error.data.error === "invalid_grant") {
      return { status: "invalid_grant" };
    }
    throw new LinearTokenRequestError(
      `Linear token request failed: ${error.success ? error.data.error : "unknown error"}`,
      response.status
    );
  }

  const parsed = linearTokenResponseSchema.safeParse(
    await response.json().catch(() => null)
  );
  if (!parsed.success) {
    throw new LinearTokenRequestError(
      "Linear returned a malformed token response",
      response.status
    );
  }

  const refreshToken = parsed.data.refresh_token ?? null;
  const ttlSeconds =
    parsed.data.expires_in ??
    (refreshToken ? LINEAR_DEFAULT_ACCESS_TOKEN_TTL_SECONDS : null);
  return {
    status: "ok",
    tokens: {
      accessToken: parsed.data.access_token,
      refreshToken,
      expiresAt:
        ttlSeconds === null ? null : new Date(Date.now() + ttlSeconds * 1000),
    },
  };
}

export async function exchangeLinearAuthorizationCode(params: {
  code: string;
  redirectUri: string;
  credentials: LinearOAuthCredentials;
}): Promise<LinearOAuthTokens> {
  const result = await requestLinearToken(
    {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    },
    params.credentials
  );
  if (result.status === "invalid_grant") {
    throw new LinearTokenRequestError(
      "Linear rejected the authorization code",
      400
    );
  }
  return result.tokens;
}

/**
 * Saves a fresh authorization. Connecting a Linear workspace that this
 * organization already has replaces the stored tokens in place, so its
 * schedules, team selection and settings keep working.
 */
export async function connectLinearIntegration(
  params: ConnectLinearIntegrationParams
): Promise<{ integrationId: string; reconnected: boolean }> {
  if (!(await hasOrganizationAccess(params.userId, params.organizationId))) {
    throw new Error("User does not have access to this organization.");
  }

  const credentials = {
    encryptedAccessToken: encryptToken(params.tokens.accessToken),
    encryptedRefreshToken: params.tokens.refreshToken
      ? encryptToken(params.tokens.refreshToken)
      : null,
    accessTokenExpiresAt: params.tokens.expiresAt,
  };

  return await db.transaction(async (tx) => {
    await advisoryXactLock(
      tx,
      linearAuthorizationLockKey(
        params.organizationId,
        params.linearOrganizationId
      )
    );

    const reconnected = await tx
      .update(linearIntegrations)
      .set({
        ...credentials,
        linearOrganizationName: params.linearOrganizationName,
      })
      .where(
        and(
          eq(linearIntegrations.organizationId, params.organizationId),
          eq(
            linearIntegrations.linearOrganizationId,
            params.linearOrganizationId
          )
        )
      )
      .returning({ id: linearIntegrations.id });
    if (reconnected[0]) {
      return { integrationId: reconnected[0].id, reconnected: true };
    }

    const [created] = await tx
      .insert(linearIntegrations)
      .values({
        id: `lin_${nanoid()}`,
        organizationId: params.organizationId,
        createdByUserId: params.userId,
        displayName: params.linearOrganizationName,
        linearOrganizationId: params.linearOrganizationId,
        linearOrganizationName: params.linearOrganizationName,
        ...credentials,
      })
      .returning({ id: linearIntegrations.id });
    if (!created) {
      throw new Error("Failed to save the Linear integration");
    }
    return { integrationId: created.id, reconnected: false };
  });
}

/**
 * A failed refresh is "uncertain" when Linear may already have rotated the
 * refresh token: the response was lost, timed out, came back as a server
 * error, or could not be saved. Linear accepts the old refresh token again
 * for 30 minutes after a rotation and returns the replacement, so these
 * failures are retried. Rejections that a retry cannot change are not.
 */
function isRetryableRefreshError(error: unknown): boolean {
  if (
    error instanceof LinearReconnectRequiredError ||
    error instanceof LinearOAuthNotConfiguredError
  ) {
    return false;
  }
  if (error instanceof LinearTokenRequestError) {
    return !(error.status >= 400 && error.status < 500 && error.status !== 429);
  }
  return true;
}

async function refreshLinearAccessTokenOnce(
  authorization: { organizationId: string; linearOrganizationId: string },
  integrationId: string,
  minimumValidityMs: number
): Promise<string> {
  const outcome = await db.transaction(async (tx) => {
    await advisoryXactLock(
      tx,
      linearAuthorizationLockKey(
        authorization.organizationId,
        authorization.linearOrganizationId
      )
    );
    const [current] = await tx
      .select(tokenColumns)
      .from(linearIntegrations)
      .where(eq(linearIntegrations.id, integrationId))
      .limit(1);

    if (
      current?.encryptedAccessToken &&
      !isLinearAccessTokenDue(current.accessTokenExpiresAt, minimumValidityMs)
    ) {
      return {
        status: "ok",
        accessToken: decryptToken(current.encryptedAccessToken),
      } as const;
    }
    if (!current?.encryptedRefreshToken) {
      return { status: "reconnect_required" } as const;
    }

    const credentials = getLinearOAuthCredentials();
    if (!credentials) {
      throw new LinearOAuthNotConfiguredError();
    }

    const result = await requestLinearToken(
      {
        grant_type: "refresh_token",
        refresh_token: decryptToken(current.encryptedRefreshToken),
      },
      credentials
    );
    const sameAuthorization = and(
      eq(linearIntegrations.organizationId, current.organizationId),
      eq(linearIntegrations.linearOrganizationId, current.linearOrganizationId),
      eq(
        linearIntegrations.encryptedRefreshToken,
        current.encryptedRefreshToken
      )
    );

    if (result.status === "invalid_grant") {
      await tx
        .update(linearIntegrations)
        .set({ encryptedRefreshToken: null })
        .where(sameAuthorization);
      return { status: "reconnect_required" } as const;
    }

    const { tokens } = result;
    await tx
      .update(linearIntegrations)
      .set({
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : current.encryptedRefreshToken,
        accessTokenExpiresAt:
          tokens.expiresAt ??
          new Date(Date.now() + LINEAR_DEFAULT_ACCESS_TOKEN_TTL_SECONDS * 1000),
      })
      .where(sameAuthorization);
    return { status: "ok", accessToken: tokens.accessToken } as const;
  });

  if (outcome.status === "reconnect_required") {
    throw new LinearReconnectRequiredError(integrationId);
  }
  return outcome.accessToken;
}

/**
 * Renews the access token unless it stays valid for `minimumValidityMs`.
 * Linear rotates refresh tokens on every use, so each attempt runs under a
 * transaction lock and re-reads the row: concurrent callers wait and then
 * reuse the token the first one saved instead of spending the old refresh
 * token again. Uncertain failures are retried well inside Linear's 30-minute
 * window for replaying a rotated refresh token.
 */
async function refreshLinearAccessToken(
  integrationId: string,
  minimumValidityMs: number
): Promise<string> {
  const [authorization] = await db
    .select({
      organizationId: linearIntegrations.organizationId,
      linearOrganizationId: linearIntegrations.linearOrganizationId,
    })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.id, integrationId))
    .limit(1);
  if (!authorization) {
    throw new Error(`Unknown Linear integration ${integrationId}.`);
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await refreshLinearAccessTokenOnce(
        authorization,
        integrationId,
        minimumValidityMs
      );
    } catch (error) {
      if (
        attempt >= LINEAR_TOKEN_REFRESH_MAX_ATTEMPTS ||
        !isRetryableRefreshError(error)
      ) {
        throw error;
      }
      await sleep(LINEAR_TOKEN_REFRESH_RETRY_DELAY_MS * attempt);
    }
  }
}

export async function resolveLinearAccessToken(
  integration: LinearTokenFields
): Promise<string> {
  if (!integration.encryptedAccessToken) {
    throw new LinearReconnectRequiredError(integration.id);
  }
  if (
    !isLinearAccessTokenDue(
      integration.accessTokenExpiresAt,
      LINEAR_ACCESS_TOKEN_REFRESH_BUFFER_MS
    )
  ) {
    return decryptToken(integration.encryptedAccessToken);
  }
  // Services without the OAuth client secret rely on the scheduled refresh and
  // use the stored token for as long as it is still valid.
  if (
    !getLinearOAuthCredentials() &&
    !isLinearAccessTokenDue(integration.accessTokenExpiresAt, 0)
  ) {
    return decryptToken(integration.encryptedAccessToken);
  }
  return await refreshLinearAccessToken(
    integration.id,
    LINEAR_ACCESS_TOKEN_REFRESH_BUFFER_MS
  );
}

/**
 * Keeps every refreshable authorization ahead of expiry. Refreshing also
 * renews Linear's 30-day refresh token, which API calls alone never extend.
 * The most urgent authorizations go first, a few at a time, and work left
 * when the time budget runs out stays due for the next run.
 */
export async function refreshDueLinearAccessTokens(options?: {
  budgetMs?: number;
}): Promise<LinearTokenRefreshSummary> {
  const deadline =
    Date.now() + (options?.budgetMs ?? LINEAR_SCHEDULED_REFRESH_BUDGET_MS);
  const due = await db
    .select({ id: linearIntegrations.id })
    .from(linearIntegrations)
    .where(
      and(
        isNotNull(linearIntegrations.encryptedRefreshToken),
        lt(
          linearIntegrations.accessTokenExpiresAt,
          new Date(Date.now() + LINEAR_SCHEDULED_REFRESH_WINDOW_MS)
        )
      )
    )
    .orderBy(asc(linearIntegrations.accessTokenExpiresAt));

  const summary: LinearTokenRefreshSummary = {
    due: due.length,
    refreshed: 0,
    reconnectRequired: 0,
    failed: 0,
    deferred: 0,
  };
  const queue = due.map(({ id }) => id);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      if (Date.now() >= deadline) {
        summary.deferred += 1 + queue.length;
        queue.length = 0;
        return;
      }
      try {
        await refreshLinearAccessToken(id, LINEAR_SCHEDULED_REFRESH_WINDOW_MS);
        summary.refreshed += 1;
      } catch (error) {
        if (error instanceof LinearReconnectRequiredError) {
          summary.reconnectRequired += 1;
        } else {
          summary.failed += 1;
          logError("[Linear] Scheduled token refresh failed", error, {
            integrationId: id,
          });
        }
      }
    }
  };
  await Promise.all(
    Array.from({ length: LINEAR_SCHEDULED_REFRESH_CONCURRENCY }, worker)
  );
  return summary;
}
