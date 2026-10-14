import {
  GscApiError,
  GscReauthRequiredError,
  queryGscTopQueries,
} from "@notra/ai/integrations/google-search-console";
import { Effect, Layer } from "effect";

import {
  GSC_SYNC_LOOKBACK_DAYS,
  GSC_SYNC_ROW_LIMIT,
} from "../constants/google-search-console";
import { GeoSearchConsoleService } from "../deps";
import { GeoSearchConsoleError } from "../schemas/search-console-errors";

export const geoSearchConsoleLive = Layer.effect(
  GeoSearchConsoleService,
  Effect.sync(() =>
    GeoSearchConsoleService.of({
      topQueries: Effect.fn("GeoSearchConsole.topQueries")(
        (integration, siteUrl) =>
          Effect.tryPromise({
            try: () =>
              queryGscTopQueries(integration, {
                siteUrl,
                days: GSC_SYNC_LOOKBACK_DAYS,
                rowLimit: GSC_SYNC_ROW_LIMIT,
              }),
            catch: (cause) =>
              new GeoSearchConsoleError({
                reauthRequired: cause instanceof GscReauthRequiredError,
                status: cause instanceof GscApiError ? cause.status : undefined,
                cause,
              }),
          })
      ),
    })
  )
);
