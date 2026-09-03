import { describe, expect, mock, test } from "bun:test";

let ownershipResult = 1;
let renewalResult = 0;
const setLock = async () => "OK";
const evaluateLockScript = async (script: string) => {
  if (script.includes('redis.call("expire"')) {
    return renewalResult;
  }
  if (script.includes("return 1")) {
    return ownershipResult;
  }
  return 1;
};

mock.module("@notra/ai/utils/redis", () => ({
  redis: {
    eval: evaluateLockScript,
    set: setLock,
  },
}));

const {
  GscIntegrationLockBusyError,
  GscIntegrationLockLostError,
  withGscIntegrationLock,
} = await import("./gsc-integration-lock");

describe("withGscIntegrationLock", () => {
  test("aborts the operation when Redis reports that the lease is lost", async () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let operationSignal: AbortSignal | undefined;
    ownershipResult = 1;
    renewalResult = 0;

    globalThis.setInterval = ((callback: () => void) => {
      queueMicrotask(callback);
      return 1;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => undefined) as typeof clearInterval;

    try {
      const result = withGscIntegrationLock("org_123", async (signal) => {
        operationSignal = signal;
        await new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
        return "completed";
      });

      let thrown: unknown;
      try {
        await result;
      } catch (error) {
        thrown = error;
      }
      expect(thrown instanceof GscIntegrationLockLostError).toBe(true);
      expect(operationSignal?.aborted).toBe(true);
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });

  test("fences a stale operation before it mutates state", async () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let mutated = false;
    ownershipResult = 0;

    globalThis.setInterval = (() => 1) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => undefined) as typeof clearInterval;

    try {
      let thrown: unknown;
      try {
        await withGscIntegrationLock(
          "org_123",
          async (_signal, assertOwned) => {
            await assertOwned();
            mutated = true;
          }
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown instanceof GscIntegrationLockLostError).toBe(true);
      expect(mutated).toBe(false);
    } finally {
      ownershipResult = 1;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });

  test("uses a distinct error when the lock wait deadline expires", async () => {
    const originalNow = Date.now;
    let firstCall = true;
    Date.now = () => {
      if (firstCall) {
        firstCall = false;
        return 0;
      }
      return Number.MAX_SAFE_INTEGER;
    };

    try {
      let thrown: unknown;
      try {
        await withGscIntegrationLock("org_123", async () => "completed");
      } catch (error) {
        thrown = error;
      }
      expect(thrown instanceof GscIntegrationLockBusyError).toBe(true);
    } finally {
      Date.now = originalNow;
    }
  });
});
