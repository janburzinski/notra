import type { Redis } from "@upstash/redis";
import { Effect } from "effect";

import {
  EXTERNAL_CACHE_KEY_PREFIX,
  EXTERNAL_CACHE_TTL_SECONDS,
  GLOBAL_SCOPE_ID,
  INITIAL_CACHE_VERSION,
  LIVE_QUERY_CACHE_TTL_SECONDS,
  QUERY_CACHE_KEY_PREFIX,
  QUERY_CACHE_TTL_SECONDS,
  VERSION_KEY_PREFIX,
  VERSIONED_CACHE_SCOPES,
} from "../constants/cache";
import type { AnalyticsCacheScope, CachedQueryOptions } from "../types/cache";
import { getAnalyticsRedis } from "./redis";

function versionKey(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): string {
  return `${VERSION_KEY_PREFIX}:${scope}:${organizationId ?? GLOBAL_SCOPE_ID}`;
}

function toJsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? Number(item) : item
    )
  );
}

function stableParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(Object.fromEntries(entries));
}

function readVersion(
  redis: Redis,
  scope: AnalyticsCacheScope,
  organizationId: string | null
): Effect.Effect<number> {
  return Effect.tryPromise(() =>
    redis.get<number>(versionKey(scope, organizationId))
  ).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((version) => version ?? INITIAL_CACHE_VERSION)
  );
}

export function cachedQuery<TResult>(
  options: CachedQueryOptions<TResult>
): Promise<TResult> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return options.fetch();
  }
  const versioned = VERSIONED_CACHE_SCOPES.has(options.scope);
  const program = Effect.gen(function* () {
    // Live (unversioned) scopes read a single key; versioned scopes pay one
    // extra round trip for the version so ingest can invalidate on demand.
    const version = versioned
      ? yield* readVersion(redis, options.scope, options.organizationId)
      : null;
    // The org segment lets purges evict live (unversioned) keys by scan.
    const key = `${QUERY_CACHE_KEY_PREFIX}:${options.scope}:${version ?? "live"}:${options.organizationId ?? GLOBAL_SCOPE_ID}:${options.pipe}:${stableParams(options.params)}`;
    const hit = yield* Effect.tryPromise(() => redis.get<TResult>(key)).pipe(
      Effect.orElseSucceed(() => null)
    );
    if (hit !== null) {
      return hit;
    }
    const fresh = yield* Effect.tryPromise(() => options.fetch());
    if (fresh !== null) {
      yield* Effect.tryPromise(() =>
        redis.set(key, toJsonSafe(fresh), {
          ex: versioned
            ? QUERY_CACHE_TTL_SECONDS
            : LIVE_QUERY_CACHE_TTL_SECONDS,
        })
      ).pipe(Effect.ignore);
    }
    return fresh;
  });
  return Effect.runPromise(program);
}

export function bumpAnalyticsVersions(
  scope: AnalyticsCacheScope,
  organizationIds: ReadonlyArray<string | null>
): Promise<void> {
  const redis = getAnalyticsRedis();
  const keys = [...new Set(organizationIds.map((id) => versionKey(scope, id)))];
  if (!redis || keys.length === 0 || !VERSIONED_CACHE_SCOPES.has(scope)) {
    return Promise.resolve();
  }
  const program = Effect.tryPromise(() => {
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.incr(key);
    }
    return pipeline.exec();
  }).pipe(Effect.ignore);
  return Effect.runPromise(program);
}

// Live scopes carry no version to bump, so data purges delete the org's
// cached query entries directly. Errors are swallowed: a lingering entry
// expires within LIVE_QUERY_CACHE_TTL_SECONDS anyway.
export function evictAnalyticsQueries(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): Promise<void> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return Promise.resolve();
  }
  const pattern = `${QUERY_CACHE_KEY_PREFIX}:${scope}:*:${organizationId ?? GLOBAL_SCOPE_ID}:*`;
  const program = Effect.tryPromise(async () => {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 200,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  }).pipe(Effect.ignore);
  return Effect.runPromise(program);
}

export function cachedExternalFetch<TResult>(
  key: string,
  fetchFresh: () => Promise<TResult>,
  ttlSeconds: number = EXTERNAL_CACHE_TTL_SECONDS
): Promise<TResult> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return fetchFresh();
  }
  const cacheKey = `${EXTERNAL_CACHE_KEY_PREFIX}:${key}`;
  const program = Effect.gen(function* () {
    const hit = yield* Effect.tryPromise(() =>
      redis.get<TResult>(cacheKey)
    ).pipe(Effect.orElseSucceed(() => null));
    if (hit !== null) {
      return hit;
    }
    const fresh = yield* Effect.tryPromise(() => fetchFresh());
    if (fresh !== null) {
      yield* Effect.tryPromise(() =>
        redis.set(cacheKey, toJsonSafe(fresh), { ex: ttlSeconds })
      ).pipe(Effect.ignore);
    }
    return fresh;
  });
  return Effect.runPromise(program);
}
