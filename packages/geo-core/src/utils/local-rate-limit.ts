import type { LocalRateLimit } from "../types/ingest";

/**
 * A token bucket per key in this process, for when the shared limiter cannot
 * answer: it refills `requests` per `windowMs`, so an outage degrades to a
 * per-instance limit instead of none. The oldest keys go when it is full.
 */
export function createLocalRateLimit(
  requests: number,
  windowMs: number,
  maxKeys: number
): LocalRateLimit {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (key, now = Date.now()) => {
    const bucket = buckets.get(key);
    const tokens = bucket
      ? Math.min(
          requests,
          bucket.tokens + ((now - bucket.at) / windowMs) * requests
        )
      : requests;
    buckets.delete(key);
    if (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) {
        buckets.delete(oldest);
      }
    }
    const admitted = tokens >= 1;
    buckets.set(key, { tokens: admitted ? tokens - 1 : tokens, at: now });
    return admitted;
  };
}
