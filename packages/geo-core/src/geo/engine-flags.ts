import { Cache, Duration, Effect, Exit } from "effect";

import { GeoFeatureFlagService } from "../deps";
import {
  GeoEngineFlagCacheKey,
  type GeoEngineFlags,
} from "../types/engine-flags";
import type { GeoFlagEvaluationError } from "./errors";

const ENGINE_FLAG_CACHE_TTL = Duration.seconds(30);
const ENGINE_FLAG_CACHE_CAPACITY = 500;

/**
 * A provider outage is a degraded answer, not a failure: the engine stays
 * hidden (fail closed) so the catalog still resolves, and `available: false`
 * marks the answer as one that must not be cached.
 */
const evaluateFlag = (
  flag: Effect.Effect<boolean, GeoFlagEvaluationError>
): Effect.Effect<{ readonly enabled: boolean; readonly available: boolean }> =>
  flag.pipe(
    Effect.map((enabled) => ({ enabled, available: true })),
    Effect.catchTag("GeoFlagEvaluationError", () =>
      Effect.succeed({ enabled: false, available: false })
    )
  );

const evaluateGeoEngineFlags = Effect.fn("geo.engineFlags.evaluate")(
  function* ({ organizationId, featureFlags }: GeoEngineFlagCacheKey) {
    const [cursor, openCode] = yield* Effect.all(
      [
        evaluateFlag(
          featureFlags.isCursorEngineEnabledForOrganization(organizationId)
        ),
        evaluateFlag(
          featureFlags.isOpenCodeEngineEnabledForOrganization(organizationId)
        ),
      ],
      { concurrency: "unbounded" }
    );
    return {
      cursorEnabled: cursor.enabled,
      openCodeEnabled: openCode.enabled,
      available: cursor.available && openCode.available,
    } satisfies GeoEngineFlags;
  }
);

const engineFlagCache = Effect.runSync(
  Cache.makeWith(evaluateGeoEngineFlags, {
    capacity: ENGINE_FLAG_CACHE_CAPACITY,
    timeToLive: (exit) =>
      Exit.isSuccess(exit) && exit.value.available
        ? ENGINE_FLAG_CACHE_TTL
        : Duration.zero,
  })
);

export const loadGeoEngineFlags = Effect.fn("geo.engineFlags")(function* (
  organizationId: string
) {
  const featureFlags = yield* GeoFeatureFlagService;
  return yield* Cache.get(
    engineFlagCache,
    new GeoEngineFlagCacheKey({ organizationId, featureFlags })
  );
});
