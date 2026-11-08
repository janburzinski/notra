import {
  createServerFlagsManager,
  type ServerFlagsManager,
} from "@databuddy/sdk/node";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Config, Effect } from "effect";

import {
  WEB_ANALYTICS_FLAG_CACHE_TTL_MS,
  WEB_ANALYTICS_FLAG_ERROR_REASON,
  WEB_ANALYTICS_FLAG_KEY,
  WEB_ANALYTICS_FLAG_STALE_TIME_MS,
  WEB_ANALYTICS_FLAG_TIMEOUT_MS,
} from "../constants/web-analytics-access";
import type { WebAnalyticsFlagState } from "../types/web-analytics-access";
import { logWarn } from "./server-log";

let cachedManager: ServerFlagsManager | null = null;

function flagsManager(clientId: string): ServerFlagsManager {
  cachedManager ??= createServerFlagsManager({
    clientId,
    cacheTtl: WEB_ANALYTICS_FLAG_CACHE_TTL_MS,
    staleTime: WEB_ANALYTICS_FLAG_STALE_TIME_MS,
  });
  return cachedManager;
}

/**
 * The `web-analytics` feature flag for one organization, shared by the
 * dashboard, API, ingest and agent tools so they always agree. On in local
 * development, off in demo mode and without a flag client id. Never fails: a
 * flag service that errors or times out answers "unavailable".
 */
export const webAnalyticsFlagState = Effect.fn("webAnalytics.flagState")(
  function* (organizationId: string) {
    if (isDemoMode()) {
      return "disabled" as const;
    }
    const nodeEnv = yield* Config.String("NODE_ENV").pipe(
      Config.withDefault("")
    );
    if (nodeEnv === "development") {
      return "enabled" as const;
    }
    const clientId = yield* Config.String(
      "NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID"
    ).pipe(Config.withDefault(""));
    if (!clientId) {
      return "disabled" as const;
    }
    const manager = yield* Effect.try(() => flagsManager(clientId));
    const result = yield* Effect.tryPromise(() =>
      manager.getFlag(WEB_ANALYTICS_FLAG_KEY, {
        organizationId,
        properties: { organizationId },
      })
    );
    if (result.reason === WEB_ANALYTICS_FLAG_ERROR_REASON) {
      return "unavailable" as const;
    }
    return result.enabled ? ("enabled" as const) : ("disabled" as const);
  },
  (effect, organizationId) =>
    effect.pipe(
      Effect.timeout(WEB_ANALYTICS_FLAG_TIMEOUT_MS),
      Effect.catch((error) =>
        Effect.sync((): WebAnalyticsFlagState => {
          logWarn("Web analytics flag unavailable", {
            organizationId,
            error: String(error),
          });
          return "unavailable";
        })
      )
    )
);

/** {@link webAnalyticsFlagState} for callers outside Effect. */
export function resolveWebAnalyticsFlagState(
  organizationId: string
): Promise<WebAnalyticsFlagState> {
  return Effect.runPromise(webAnalyticsFlagState(organizationId));
}

/** Fails closed: an unanswered flag reads as off. */
export async function isWebAnalyticsEnabledForOrganization(
  organizationId: string
): Promise<boolean> {
  return (await resolveWebAnalyticsFlagState(organizationId)) === "enabled";
}
