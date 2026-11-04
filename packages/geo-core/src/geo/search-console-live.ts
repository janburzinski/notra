import {
  GscApiError,
  GscReauthRequiredError,
  queryGscQueryPages,
  queryGscTopQueries,
} from "@notra/ai/integrations/google-search-console";
import { Effect, Layer } from "effect";

import {
  GSC_PAGE_ROW_LIMIT,
  GSC_QUESTION_QUERY_PATTERN,
  GSC_QUESTION_ROW_LIMIT,
  GSC_SYNC_LOOKBACK_DAYS,
  GSC_SYNC_ROW_LIMIT,
} from "../constants/google-search-console";
import { GeoSearchConsoleService } from "../deps";
import { GeoSearchConsoleError } from "../schemas/search-console-errors";

function query<A>(run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new GeoSearchConsoleError({
        reauthRequired: cause instanceof GscReauthRequiredError,
        status: cause instanceof GscApiError ? cause.status : undefined,
        cause,
      }),
  });
}

export const geoSearchConsoleLive = Layer.effect(
  GeoSearchConsoleService,
  Effect.sync(() =>
    GeoSearchConsoleService.of({
      topQueries: Effect.fn("GeoSearchConsole.topQueries")(
        (integration, siteUrl) =>
          query(() =>
            queryGscTopQueries(integration, {
              siteUrl,
              days: GSC_SYNC_LOOKBACK_DAYS,
              rowLimit: GSC_SYNC_ROW_LIMIT,
            })
          )
      ),
      questionQueries: Effect.fn("GeoSearchConsole.questionQueries")(
        (integration, siteUrl) =>
          query(() =>
            queryGscTopQueries(integration, {
              siteUrl,
              days: GSC_SYNC_LOOKBACK_DAYS,
              rowLimit: GSC_QUESTION_ROW_LIMIT,
              queryPattern: GSC_QUESTION_QUERY_PATTERN,
            })
          )
      ),
      queryPages: Effect.fn("GeoSearchConsole.queryPages")(
        (integration, siteUrl) =>
          query(() =>
            queryGscQueryPages(integration, {
              siteUrl,
              days: GSC_SYNC_LOOKBACK_DAYS,
              rowLimit: GSC_PAGE_ROW_LIMIT,
            })
          )
      ),
    })
  )
);
