import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { compactMemoryHistory } from "@notra/memory/memory";

import { AUTOPILOT_MEMORY_COMPACTION_LOCK_KEY } from "@/constants/autopilot";

/** Drops week-old memory history, so removed and retracted notes don't linger. */
export async function compactAutopilotMemory(now: Date, signal: AbortSignal) {
  const idle = { compacted: 0, deleted: 0, failed: 0 };
  try {
    // The lock lasts as long as the transaction, which ends with the sweep.
    return await db.transaction(async (tx) => {
      const locked = await advisoryXactLock(
        tx,
        AUTOPILOT_MEMORY_COMPACTION_LOCK_KEY,
        { try: true }
      );
      if (!locked) {
        return idle;
      }
      return compactMemoryHistory({
        now,
        signal,
        onError: (repo, error) =>
          logError("[Autopilot] Memory history compaction will retry", error, {
            repo,
          }),
      });
    });
  } catch (error) {
    // Running out of time is no failure: the next sweep goes on.
    if (signal.aborted) {
      return idle;
    }
    logError("[Autopilot] Memory history compaction failed", error);
    return { ...idle, failed: 1 };
  }
}
