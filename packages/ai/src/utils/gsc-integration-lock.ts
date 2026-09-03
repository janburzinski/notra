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

const OWN_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return 1
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
    throw new GscIntegrationLockBusyError();
  }

  const controller = new AbortController();
  let rejectLeaseLoss!: (error: GscIntegrationLockLostError) => void;
  const leaseLoss = new Promise<never>((_, reject) => {
    rejectLeaseLoss = reject;
  });
  let finished = false;
  let renewalInFlight = false;

  const loseLease = (cause?: unknown) => {
    if (finished || controller.signal.aborted) {
      return;
    }
    const error = new GscIntegrationLockLostError(cause);
    controller.abort(error);
    rejectLeaseLoss(error);
  };

  const assertOwned = async () => {
    controller.signal.throwIfAborted();
    try {
      const owned = await activeRedis.eval<string[], number>(
        OWN_LOCK_SCRIPT,
        [lockKey],
        [ownerToken]
      );
      if (owned !== 1) {
        loseLease();
      }
    } catch (error) {
      console.error("[GSC] Failed to verify integration lock:", error);
      loseLease(error);
    }
    controller.signal.throwIfAborted();
  };

  const renewal = setInterval(
    () => {
      if (finished || renewalInFlight) {
        return;
      }
      renewalInFlight = true;
      void activeRedis
        .eval<string[], number>(
          RENEW_LOCK_SCRIPT,
          [lockKey],
          [ownerToken, String(GSC_INTEGRATION_LOCK_TTL_SECONDS)]
        )
        .then((renewed) => {
          if (renewed !== 1) {
            loseLease();
          }
        })
        .catch((error) => {
          console.error("[GSC] Failed to renew integration lock:", error);
          loseLease(error);
        })
        .finally(() => {
          renewalInFlight = false;
        });
    },
    (GSC_INTEGRATION_LOCK_TTL_SECONDS * 1000) / 3
  );

  try {
    return await Promise.race([
      operation(controller.signal, assertOwned),
      leaseLoss,
    ]);
  } finally {
    finished = true;
    clearInterval(renewal);
    try {
      await activeRedis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [ownerToken]);
    } catch (error) {
      console.error("[GSC] Failed to release integration lock:", error);
    }
  }
}
