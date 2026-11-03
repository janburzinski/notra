import type {
  UsageBatcher,
  UsageBatcherOptions,
} from "../types/ingest-batcher";

/**
 * Sums tracked events per organization and reports each sum to Autumn once
 * per interval, instead of one billing request per event. Sums Autumn
 * certainly did not record are retried at the next interval. After `stop`,
 * `add` refuses counts so callers report them directly. Counts still buffered
 * when the process is killed are lost, like a deferred per-event request that
 * was still in flight.
 */
export function createUsageBatcher({
  intervalMs,
  track,
}: UsageBatcherOptions): UsageBatcher {
  let counts = new Map<string, number>();
  let buffered = 0;
  let stopped = false;
  const flushes = new Set<Promise<unknown>>();

  function count(organizationId: string, value: number) {
    counts.set(organizationId, (counts.get(organizationId) ?? 0) + value);
    buffered += value;
  }

  async function report(organizationId: string, value: number) {
    if (!((await track(organizationId, value)) || stopped)) {
      count(organizationId, value);
    }
  }

  function flush() {
    if (counts.size === 0) {
      return;
    }
    const batch = counts;
    counts = new Map();
    buffered = 0;
    const flushing = Promise.all(
      [...batch].map(([organizationId, value]) => report(organizationId, value))
    );
    flushes.add(flushing);
    flushing.finally(() => flushes.delete(flushing));
  }

  const timer = setInterval(flush, intervalMs);
  timer.unref();

  return {
    add(organizationId, value) {
      if (stopped) {
        return false;
      }
      count(organizationId, value);
      return true;
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      flush();
      await Promise.all(flushes);
    },
    size: () => buffered,
  };
}
