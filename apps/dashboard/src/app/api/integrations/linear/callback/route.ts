import { invalidateStandaloneChatIntegrations } from "@notra/ai/chat/integrations-cache";
import {
  connectLinearIntegration,
  exchangeLinearAuthorizationCode,
  getLinearOAuthCredentials,
} from "@notra/ai/integrations/linear-oauth";
import type { LinearOAuthTokens } from "@notra/ai/types/linear-oauth";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { buildCallbackUrl } from "@notra/utils/callback-url";
import { ORPCError } from "@orpc/server";

import {
  INTEGRATION_AUTH_KINDS,
  INTEGRATION_PROVIDERS,
} from "@/constants/integration-analytics";
import { LINEAR_OAUTH_STATE_TTL_SECONDS } from "@/constants/linear";
import { redirectResponse } from "@/lib/auth/http";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";
import {
  trackIntegrationConnected,
  trackIntegrationConnectFailed,
} from "@/lib/integrations/connect-events";
import { linearOAuthErrorParam } from "@/lib/integrations/linear/oauth-errors";
import {
  linearOAuthStateSchema,
  linearOrganizationQuerySchema,
} from "@/schemas/linear-oauth";
import type { LinearOAuthState } from "@/types/linear-oauth";

export async function GET(request: Request) {
  const baseUrl = getAppUrl() ?? "";

  let restoreOAuthState: (() => Promise<void>) | null = null;
  const trackFailed = (errorCode: string, oauthState?: LinearOAuthState) =>
    trackIntegrationConnectFailed({
      headers: request.headers,
      userId: oauthState?.userId,
      organizationId: oauthState?.organizationId,
      provider: INTEGRATION_PROVIDERS.LINEAR,
      authKind: INTEGRATION_AUTH_KINDS.OAUTH,
      errorCode,
    });

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      trackFailed(error);
      return redirectResponse(`${baseUrl}/?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state || !redis) {
      trackFailed("invalid_callback");
      return redirectResponse(`${baseUrl}/?error=invalid_callback`);
    }

    const stateKey = `linear_oauth:${state}`;
    const remainingTtlSeconds = await redis.ttl(stateKey);
    const raw = await redis.getdel<string>(stateKey);
    if (!raw) {
      return redirectResponse(`${baseUrl}/?error=expired_state`);
    }

    const restoreTtlSeconds = Math.min(
      remainingTtlSeconds,
      LINEAR_OAUTH_STATE_TTL_SECONDS
    );

    const activeRedis = redis;
    restoreOAuthState = async () => {
      if (restoreTtlSeconds <= 0) {
        return;
      }
      try {
        await activeRedis.set(
          stateKey,
          typeof raw === "string" ? raw : JSON.stringify(raw),
          { ex: restoreTtlSeconds }
        );
      } catch (restoreError) {
        logError(
          "Failed to restore Linear OAuth state for retry",
          restoreError
        );
      }
    };

    const parsedState = linearOAuthStateSchema.safeParse(raw);
    if (!parsedState.success) {
      return redirectResponse(`${baseUrl}/?error=expired_state`);
    }
    const oauthState = parsedState.data;

    const { session, user } = await getServerSession({
      headers: request.headers,
    });
    if (!session?.userId || session.userId !== oauthState.userId) {
      await restoreOAuthState();
      return redirectResponse(`${baseUrl}/?error=session_mismatch`);
    }

    try {
      await assertOrganizationAccess({
        headers: request.headers,
        organizationId: oauthState.organizationId,
        user,
      });
    } catch (error) {
      if (error instanceof ORPCError) {
        await restoreOAuthState();
        return redirectResponse(
          `${baseUrl}/?error=${linearOAuthErrorParam(error.status, "forbidden")}`
        );
      }
      throw error;
    }

    const credentials = getLinearOAuthCredentials();
    if (!credentials) {
      await restoreOAuthState();
      return redirectResponse(`${baseUrl}/?error=linear_not_configured`);
    }

    let tokens: LinearOAuthTokens;
    try {
      tokens = await exchangeLinearAuthorizationCode({
        code,
        redirectUri: `${baseUrl}/api/integrations/linear/callback`,
        credentials,
      });
    } catch (exchangeError) {
      logError("Linear token exchange failed", exchangeError);
      await restoreOAuthState();
      trackFailed("token_exchange_failed", oauthState);
      return redirectResponse(`${baseUrl}/?error=token_exchange_failed`);
    }

    const orgRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        query: `{
          organization {
            id
            name
          }
        }`,
      }),
    });

    if (!orgRes.ok) {
      logError("Linear organization fetch failed", undefined, {
        status: orgRes.status,
        body: await orgRes.text(),
      });
      await restoreOAuthState();
      return redirectResponse(`${baseUrl}/?error=org_fetch_failed`);
    }

    const orgData = linearOrganizationQuerySchema.safeParse(
      await orgRes.json().catch(() => null)
    );
    if (!orgData.success) {
      logError("Linear organization response was malformed", orgData.error);
      await restoreOAuthState();
      return redirectResponse(`${baseUrl}/?error=org_fetch_failed`);
    }
    const linearOrg = orgData.data.data.organization;

    const { reconnected } = await connectLinearIntegration({
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
      linearOrganizationId: linearOrg.id,
      linearOrganizationName: linearOrg.name,
      tokens,
    });

    await invalidateStandaloneChatIntegrations(oauthState.organizationId);

    trackIntegrationConnected({
      headers: request.headers,
      userId: oauthState.userId,
      organizationId: oauthState.organizationId,
      provider: INTEGRATION_PROVIDERS.LINEAR,
      authKind: INTEGRATION_AUTH_KINDS.OAUTH,
    });

    return redirectResponse(
      buildCallbackUrl(
        baseUrl,
        oauthState.callbackPath,
        reconnected
          ? { linearReconnected: "true" }
          : { linearConnected: "true" }
      )
    );
  } catch (error) {
    logError("Error in Linear OAuth callback", error);
    await restoreOAuthState?.();
    trackFailed("callback_failed");
    return redirectResponse(`${baseUrl}/?error=callback_failed`);
  }
}
