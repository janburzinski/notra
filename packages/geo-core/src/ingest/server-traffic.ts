import { redis } from "@notra/ai/utils/redis";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import { Cache, Effect } from "effect";

import {
  GEO_INGEST_MEMO_MAX_ENTRIES,
  GEO_SERVER_TRAFFIC_KEY_PREFIX,
  GEO_SERVER_TRAFFIC_MARK_INTERVAL_MS,
  GEO_SERVER_TRAFFIC_MEMO_MS,
  GEO_SERVER_TRAFFIC_TTL_SECONDS,
} from "../constants/ingest";
import { GeoIngestScopeCacheKey } from "../types/ingest-cache-keys";
import { geoIngestScopeKey } from "../utils/geo-ingest-identity-policy";

function redisKey(
  scope: Pick<GeoIngestIdentity, "organizationId" | "projectId">
) {
  return `${GEO_SERVER_TRAFFIC_KEY_PREFIX}:${geoIngestScopeKey(scope)}`;
}

// The marker write is kept an hour, so each replica writes it at most hourly.
const marked = Effect.runSync(
  Cache.make({
    capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
    timeToLive: GEO_SERVER_TRAFFIC_MARK_INTERVAL_MS,
    lookup: (key: string) =>
      Effect.promise(async () => {
        await redis
          ?.set(key, "1", { ex: GEO_SERVER_TRAFFIC_TTL_SECONDS })
          .catch(() => null);
      }),
  })
);

// A project also counts traffic marked by a legacy organization-wide token.
// Unknown (lookup failed) counts as active so we never double count.
const known = Effect.runSync(
  Cache.make({
    capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
    timeToLive: GEO_SERVER_TRAFFIC_MEMO_MS,
    lookup: (scope: GeoIngestScopeCacheKey) => {
      const keys = scope.projectId
        ? [redisKey(scope), redisKey({ ...scope, projectId: null })]
        : [redisKey(scope)];
      return Effect.promise(async () => {
        if (!redis) {
          return true;
        }
        return await redis
          .exists(...keys)
          .then((count) => count > 0)
          .catch(() => true);
      });
    },
  })
);

/**
 * Records that the server SDK or a log drain reports AI traffic for this
 * scope. Written at most once an hour per replica.
 */
export async function markServerTraffic(
  identity: GeoIngestIdentity
): Promise<void> {
  if (!redis) {
    return;
  }
  await Effect.runPromise(Cache.get(marked, redisKey(identity)));
}

/**
 * Whether server-side tracking already reports this scope's AI referrals, in
 * which case the browser script must not record them again. Unknown (no
 * Redis, lookup failed) counts as active so we never double count.
 */
export function hasServerTraffic(
  identity: GeoIngestIdentity
): Promise<boolean> {
  if (!redis) {
    return Promise.resolve(true);
  }
  return Effect.runPromise(
    Cache.get(
      known,
      new GeoIngestScopeCacheKey({
        organizationId: identity.organizationId,
        projectId: identity.projectId,
        recent: true,
      })
    )
  );
}
