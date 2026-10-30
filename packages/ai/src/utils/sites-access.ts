import {
  createServerFlagsManager,
  type ServerFlagsManager,
} from "@databuddy/sdk/node";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Config, ConfigProvider, Effect } from "effect";

import {
  SITES_FLAG_CACHE_TTL_MS,
  SITES_FLAG_KEY,
  SITES_FLAG_STALE_TIME_MS,
  SITES_FLAG_TIMEOUT_MS,
} from "../constants/sites-access";
import { SitesAccessError } from "../schemas/sites-access";

let cachedManager: ServerFlagsManager | null = null;

export function isSitesEnabledForOrganization(
  organizationId: string
): Promise<boolean> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const clientId = yield* Config.String(
        "NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID"
      ).pipe(Config.withDefault(""));
      if (!clientId || isDemoMode()) {
        return false;
      }
      const manager = yield* Effect.try({
        try: () =>
          cachedManager ??
          createServerFlagsManager({
            clientId,
            cacheTtl: SITES_FLAG_CACHE_TTL_MS,
            staleTime: SITES_FLAG_STALE_TIME_MS,
          }),
        catch: () => new SitesAccessError(),
      });
      cachedManager = manager;
      const result = yield* Effect.tryPromise({
        try: () =>
          manager.getFlag(SITES_FLAG_KEY, {
            organizationId,
            properties: { organizationId },
          }),
        catch: () => new SitesAccessError(),
      });
      return result.reason !== "ERROR" && result.enabled;
    }).pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
      Effect.timeout(SITES_FLAG_TIMEOUT_MS),
      Effect.catch(() => Effect.succeed(false))
    )
  );
}
