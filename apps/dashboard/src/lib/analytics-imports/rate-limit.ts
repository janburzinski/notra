import { redis } from "@notra/ai/utils/redis";
import {
  IMPORT_RATE_LIMIT_KEY_PREFIX,
  IMPORT_RATE_LIMITS,
} from "@notra/geo-core/constants/analytics-imports";
import { ImportRateLimitedError } from "@notra/geo-core/schemas/analytics-import-errors";
import type { ImportFetch } from "@notra/geo-core/types/analytics-imports";

import type { ImportRateWindow } from "@/types/analytics-imports";

const DAY_SECONDS = 86_400;

/** The provider's windows, shortest first; a daily one starts at 00:00 UTC. */
function importRateWindows(provider: keyof typeof IMPORT_RATE_LIMITS) {
  const limit = IMPORT_RATE_LIMITS[provider];
  const windows: ImportRateWindow[] = [
    { requests: limit.requests, windowSeconds: limit.windowSeconds },
  ];
  if ("dailyRequests" in limit) {
    windows.push({ requests: limit.dailyRequests, windowSeconds: DAY_SECONDS });
  }
  return windows;
}

/**
 * Wraps fetch with per-connection request budgets kept in Redis, so imports
 * never spend the customer's whole provider quota. A full window surfaces as
 * a rate-limit error and the workflow sleeps until it resets. Without Redis
 * the provider's own 429s still apply.
 */
export function rateLimitedImportFetch(
  provider: keyof typeof IMPORT_RATE_LIMITS,
  connectionId: string,
  fetchImpl: ImportFetch = fetch
): ImportFetch {
  const windows = importRateWindows(provider);
  return async (input, init) => {
    const client = redis;
    if (client) {
      const now = Math.floor(Date.now() / 1000);
      for (const { requests, windowSeconds } of windows) {
        const window = Math.floor(now / windowSeconds);
        const key = `${IMPORT_RATE_LIMIT_KEY_PREFIX}:${provider}:${connectionId}:${windowSeconds}:${window}`;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- a full short window must not spend the daily budget
        const used = await client.incr(key);
        if (used === 1) {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- expires the key the incr above just created
          await client.expire(key, windowSeconds);
        }
        if (used > requests) {
          throw new ImportRateLimitedError({
            provider,
            retryAfterSeconds: (window + 1) * windowSeconds - now + 1,
            budget: true,
          });
        }
      }
    }
    return await fetchImpl(input, init);
  };
}
