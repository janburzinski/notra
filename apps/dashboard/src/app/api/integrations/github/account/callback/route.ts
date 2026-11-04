import { linkGitHubUserAccount } from "@notra/ai/integrations/github";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { githubAccountLinkStateSchema } from "@notra/schemas/dashboard/github";
import { buildCallbackUrl } from "@notra/utils/callback-url";

import {
  GITHUB_ACCOUNT_LINK_CALLBACK_PATH,
  GITHUB_ACCOUNT_LINK_STATE_PREFIX,
} from "@/constants/github";
import {
  INTEGRATION_AUTH_KINDS,
  INTEGRATION_PROVIDERS,
} from "@/constants/integration-analytics";
import { redirectResponse } from "@/lib/auth/http";
import { getServerSession } from "@/lib/auth/session";
import { trackIntegrationConnectFailed } from "@/lib/integrations/connect-events";
import { ratelimit } from "@/utils/ratelimit";

async function takeLinkState(state: string | null) {
  if (!(state && redis)) {
    return null;
  }
  const raw = await redis.getdel<unknown>(
    `${GITHUB_ACCOUNT_LINK_STATE_PREFIX}${state}`
  );
  const parsed = githubAccountLinkStateSchema.safeParse(
    typeof raw === "string" ? JSON.parse(raw) : raw
  );
  return parsed.success ? parsed.data : null;
}

export async function GET(request: Request) {
  const baseUrl = getAppUrl() ?? "";
  let callbackPath: string | null = null;
  const fail = (code: string) => {
    trackIntegrationConnectFailed({
      headers: request.headers,
      provider: INTEGRATION_PROVIDERS.GITHUB,
      authKind: INTEGRATION_AUTH_KINDS.OAUTH,
      errorCode: code,
    });
    return redirectResponse(
      callbackPath
        ? buildCallbackUrl(baseUrl, callbackPath, { githubError: code })
        : `${baseUrl}/?error=${encodeURIComponent(code)}`
    );
  };

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const linkState = await takeLinkState(searchParams.get("state"));
    callbackPath = linkState?.callbackPath ?? null;

    if (error) {
      return fail(
        error === "access_denied"
          ? "account_link_cancelled"
          : "github_callback_failed"
      );
    }
    if (!code) {
      return fail("invalid_callback");
    }
    if (!linkState) {
      return fail("expired_state");
    }

    const { session } = await getServerSession({ headers: request.headers });
    if (!session?.userId || session.userId !== linkState.userId) {
      return fail("session_mismatch");
    }

    const { success: withinLimit } = await ratelimit.githubAppCallback.limit(
      session.userId
    );
    if (!withinLimit) {
      return fail("too_many_requests");
    }

    await linkGitHubUserAccount({
      userId: session.userId,
      code,
      redirectUri: `${baseUrl}${GITHUB_ACCOUNT_LINK_CALLBACK_PATH}`,
    });

    return redirectResponse(`${baseUrl}${linkState.returnTo}`);
  } catch (error) {
    logError("Error linking GitHub account", error);
    return fail("github_callback_failed");
  }
}
