import {
  GSC_INTEGRATION_LOCK_KEY_PREFIX,
  GSC_INTEGRATION_LOCK_RETRY_DELAY_MS,
  GSC_INTEGRATION_LOCK_TTL_SECONDS,
  GSC_INTEGRATION_LOCK_WAIT_MS,
} from "@notra/ai/constants/google-search-console";
import { redis } from "@notra/ai/utils/redis";

const RENEW_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function withGscIntegrationLock<T>(
  organizationId: string,
  operation: () => Promise<T>
): Promise<T> {
  const activeRedis = redis;
  // OAuth cannot be initiated without Redis. Preserve disconnect and manual
  // sync support in unconfigured development environments where no competing
  // callback can be created.
  if (!activeRedis) {
    return await operation();
  }

  const lockKey = `${GSC_INTEGRATION_LOCK_KEY_PREFIX}${organizationId}`;
  const ownerToken = crypto.randomUUID();
  const deadline = Date.now() + GSC_INTEGRATION_LOCK_WAIT_MS;
  let acquired = false;

  while (!acquired && Date.now() < deadline) {
    acquired =
      (await activeRedis.set(lockKey, ownerToken, {
        nx: true,
        ex: GSC_INTEGRATION_LOCK_TTL_SECONDS,
      })) === "OK";
    if (!acquired) {
      await sleep(GSC_INTEGRATION_LOCK_RETRY_DELAY_MS);
    }
  }

  if (!acquired) {
    throw new Error("Google Search Console integration update is busy");
  }

  const renewal = setInterval(
    () => {
      void activeRedis
        .eval(
          RENEW_LOCK_SCRIPT,
          [lockKey],
          [ownerToken, String(GSC_INTEGRATION_LOCK_TTL_SECONDS)]
        )
        .catch((error) => {
          console.error("[GSC] Failed to renew integration lock:", error);
        });
    },
    (GSC_INTEGRATION_LOCK_TTL_SECONDS * 1000) / 3
  );

  try {
    return await operation();
  } finally {
    clearInterval(renewal);
    try {
      await activeRedis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [ownerToken]);
    } catch (error) {
      console.error("[GSC] Failed to release integration lock:", error);
    }
  }
}
