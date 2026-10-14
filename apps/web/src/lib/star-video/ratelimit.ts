import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Data, Effect } from "effect";

import { getClientIp } from "@/utils/client-ip";

type LimiterKind = "lookup" | "render" | "render-global";

const LIMITS: Record<LimiterKind, { requests: number; window: "1 h" }> = {
  lookup: { requests: 20, window: "1 h" },
  render: { requests: 10, window: "1 h" },
  "render-global": { requests: 40, window: "1 h" },
};

class StarVideoRateLimitExceeded extends Data.TaggedError(
  "StarVideoRateLimitExceeded"
)<{ readonly reset: number }> {}

const limiters: Partial<Record<LimiterKind, Ratelimit | null>> = {};

function getLimiter(kind: LimiterKind): Ratelimit | null {
  if (limiters[kind] !== undefined) {
    return limiters[kind] ?? null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!(url && token)) {
    limiters[kind] = null;
    return null;
  }

  limiters[kind] = new Ratelimit({
    redis: new Redis({ url, token }),
    prefix: `ratelimit:web:star-video-${kind}`,
    limiter: Ratelimit.slidingWindow(
      LIMITS[kind].requests,
      LIMITS[kind].window
    ),
  });
  return limiters[kind] ?? null;
}

function getRateLimitKey(request: Request): string {
  return createHash("sha256").update(getClientIp(request)).digest("hex");
}

const enforceLimit = Effect.fn("enforceStarVideoLimit")(function* (
  kind: LimiterKind,
  key: string
) {
  const limiter = getLimiter(kind);

  if (!limiter) {
    const isDeployed =
      process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    if (isDeployed) {
      console.warn(
        `star-video rate limiter unavailable for "${kind}"; failing closed`
      );
      return yield* Effect.fail(new StarVideoRateLimitExceeded({ reset: 0 }));
    }
    return;
  }

  const result = yield* Effect.tryPromise({
    try: () => limiter.limit(key),
    catch: () => new StarVideoRateLimitExceeded({ reset: 0 }),
  });

  if (!result.success) {
    return yield* Effect.fail(
      new StarVideoRateLimitExceeded({ reset: result.reset })
    );
  }
});

export const enforceStarVideoRateLimit = Effect.fn("enforceStarVideoRateLimit")(
  function* (request: Request, kind: "lookup" | "render") {
    yield* enforceLimit(kind, getRateLimitKey(request));
  }
);

export const enforceGlobalRenderLimit = Effect.fn("enforceGlobalRenderLimit")(
  function* () {
    yield* enforceLimit("render-global", "global");
  }
);
