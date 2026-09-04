import {
  GSC_INTEGRATION_LOCK_KEY_PREFIX,
  GSC_INTEGRATION_LOCK_REDIS_TIMEOUT_MS,
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

export class GscIntegrationLockBusyError extends Error {
  constructor() {
    super("Google Search Console integration update is busy");
    this.name = "GscIntegrationLockBusyError";
  }
}

export class GscIntegrationLockLostError extends Error {
  constructor(cause?: unknown) {
    super("Google Search Console integration lock was lost", { cause });
    this.name = "GscIntegrationLockLostError";
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withRedisTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Redis lock request timed out"));
    }, timeoutMs);
    operation
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export async function withGscIntegrationLock<T>(
  organizationId: string,
  operation: (
    signal: AbortSignal,
    assertOwned: () => Promise<void>
  ) => Promise<T>
): Promise<T> {
  const activeRedis = redis;
  // OAuth cannot be initiated without Redis. Preserve disconnect and manual
  // sync support in unconfigured development environments where no competing
  // callback can be created.
  if (!activeRedis) {
    const signal = new AbortController().signal;
    return await operation(signal, async () => signal.throwIfAborted());
  }

  const lockKey = `${GSC_INTEGRATION_LOCK_KEY_PREFIX}${organizationId}`;
  const ownerToken = crypto.randomUUID();
  const deadline = Date.now() + GSC_INTEGRATION_LOCK_WAIT_MS;
  const lockTtlMs = GSC_INTEGRATION_LOCK_TTL_SECONDS * 1000;
  let acquired = false;
  let leaseValidUntil = 0;

  while (!acquired && Date.now() < deadline) {
    const acquisitionStartedAt = Date.now();
    const remainingWaitMs = deadline - acquisitionStartedAt;
    if (remainingWaitMs <= 0) {
      break;
    }
    try {
      acquired =
        (await withRedisTimeout(
          activeRedis.set(lockKey, ownerToken, {
            nx: true,
            ex: GSC_INTEGRATION_LOCK_TTL_SECONDS,
          }),
          Math.min(GSC_INTEGRATION_LOCK_REDIS_TIMEOUT_MS, remainingWaitMs)
        )) === "OK";
    } catch (error) {
      console.error("[GSC] Failed to acquire integration lock:", error);
    }
    if (acquired) {
      // Redis starts the TTL before the HTTP response reaches us. Using the
      // request start is conservative when checking the local lease deadline.
      leaseValidUntil = acquisitionStartedAt + lockTtlMs;
    }
    if (!acquired) {
      const remainingRetryMs = deadline - Date.now();
      if (remainingRetryMs > 0) {
        await sleep(
          Math.min(GSC_INTEGRATION_LOCK_RETRY_DELAY_MS, remainingRetryMs)
        );
      }
    }
  }

  if (!acquired) {
    throw new GscIntegrationLockBusyError();
  }

  const controller = new AbortController();
  let leaseLossError: GscIntegrationLockLostError | null = null;
  let finished = false;
  let renewalInFlight = false;

  const loseLease = (cause?: unknown) => {
    if (finished || controller.signal.aborted) {
      return;
    }
    const error = new GscIntegrationLockLostError(cause);
    leaseLossError = error;
    controller.abort(error);
  };

  const renewLease = async () => {
    const renewalStartedAt = Date.now();
    const remainingLeaseMs = leaseValidUntil - renewalStartedAt;
    if (remainingLeaseMs <= 0) {
      throw new Error("Redis integration lock expired");
    }
    const renewed = await withRedisTimeout(
      activeRedis.eval<string[], number>(
        RENEW_LOCK_SCRIPT,
        [lockKey],
        [ownerToken, String(GSC_INTEGRATION_LOCK_TTL_SECONDS)]
      ),
      Math.min(GSC_INTEGRATION_LOCK_REDIS_TIMEOUT_MS, remainingLeaseMs)
    );
    if (renewed !== 1) {
      throw new Error("Redis integration lock is no longer owned");
    }
    leaseValidUntil = renewalStartedAt + lockTtlMs;
  };

  const assertOwned = async () => {
    controller.signal.throwIfAborted();
    try {
      await renewLease();
    } catch (error) {
      console.error("[GSC] Failed to verify integration lock:", error);
      loseLease(error);
    }
    controller.signal.throwIfAborted();
  };

  let renewal: ReturnType<typeof setInterval> | null = null;
  try {
    // Ensure a delayed acquisition response did not consume the initial TTL.
    await assertOwned();
    renewal = setInterval(() => {
      if (finished || renewalInFlight || controller.signal.aborted) {
        return;
      }
      renewalInFlight = true;
      void renewLease()
        .catch((error) => {
          console.error("[GSC] Failed to renew integration lock:", error);
          loseLease(error);
        })
        .finally(() => {
          renewalInFlight = false;
        });
    }, lockTtlMs / 3);

    try {
      const result = await operation(controller.signal, assertOwned);
      if (leaseLossError) {
        throw leaseLossError;
      }
      return result;
    } catch (error) {
      if (leaseLossError) {
        throw leaseLossError;
      }
      throw error;
    }
  } finally {
    finished = true;
    if (renewal) {
      clearInterval(renewal);
    }
    try {
      await withRedisTimeout(
        activeRedis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [ownerToken]),
        GSC_INTEGRATION_LOCK_REDIS_TIMEOUT_MS
      );
    } catch (error) {
      console.error("[GSC] Failed to release integration lock:", error);
    }
  }
}
