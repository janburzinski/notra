import { redis } from "@notra/ai/utils/redis";
import {
  IMPORT_RATE_LIMIT_KEY_PREFIX,
  IMPORT_RATE_LIMITS,
} from "@notra/geo-core/constants/analytics-imports";
import { ImportRateLimitedError } from "@notra/geo-core/schemas/analytics-import-errors";
import type { ImportFetch } from "@notra/geo-core/types/analytics-imports";

/**
 * Wraps fetch with a per-connection request budget kept in Redis, so imports
 * never spend the customer's whole provider quota. A full window surfaces as
 * a rate-limit error and the workflow sleeps until it resets. Without Redis
 * the provider's own 429s still apply.
 */
export function rateLimitedImportFetch(
  provider: keyof typeof IMPORT_RATE_LIMITS,
  connectionId: string,
  fetchImpl: ImportFetch = fetch
): ImportFetch {
  const { requests, windowSeconds } = IMPORT_RATE_LIMITS[provider];
  return async (input, init) => {
    const client = redis;
    if (client) {
      const now = Math.floor(Date.now() / 1000);
      const window = Math.floor(now / windowSeconds);
      const key = `${IMPORT_RATE_LIMIT_KEY_PREFIX}:${provider}:${connectionId}:${window}`;
      const used = await client.incr(key);
      if (used === 1) {
        await client.expire(key, windowSeconds);
      }
      if (used > requests) {
        throw new ImportRateLimitedError({
          provider,
          retryAfterSeconds: (window + 1) * windowSeconds - now + 1,
        });
      }
    }
    return await fetchImpl(input, init);
  };
}
