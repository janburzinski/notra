import { RUN_TTL_S } from "@/constants/server";
import { STORAGE_KEYS } from "@/constants/site";
import type { GameStats } from "@/types/game";
import type { FinishedRun } from "@/types/session";
import { fromBase64Url, toBase64Url } from "@/utils/base64url";
import { isModelId } from "@/utils/models";
import { readStored, writeStored } from "@/utils/storage";

/** Keeps a finished run in the browser so it can still be saved after signing in with X. */
export function savePendingRun(run: FinishedRun) {
  if (!run.runId) {
    return;
  }
  writeStored(
    STORAGE_KEYS.pending,
    JSON.stringify({
      runId: run.runId,
      model: run.model,
      replay: toBase64Url(run.replay),
      stats: run.stats,
      savedAt: Date.now(),
    })
  );
}

export function takePendingRun(): FinishedRun | null {
  const raw = readStored(STORAGE_KEYS.pending);
  writeStored(STORAGE_KEYS.pending, null);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isPendingRun(parsed) ||
      Date.now() - parsed.savedAt > RUN_TTL_S * 1000
    ) {
      return null;
    }
    return {
      runId: parsed.runId,
      model: parsed.model,
      stats: parsed.stats,
      replay: fromBase64Url(parsed.replay),
    };
  } catch {
    return null;
  }
}

const STAT_KEYS = ["score", "wave", "kills", "bosses", "ticks"] as const;

/**
 * Checks what came back out of localStorage by hand: it's six fields, and a schema library would add
 * its whole runtime to the game's bundle for them.
 */
function isPendingRun(value: unknown): value is {
  runId: string;
  model: FinishedRun["model"];
  replay: string;
  stats: GameStats;
  savedAt: number;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const run = value as Record<string, unknown>;
  const stats = run.stats as Record<string, unknown> | null | undefined;
  return (
    typeof run.runId === "string" &&
    run.runId.length > 0 &&
    isModelId(run.model) &&
    typeof run.replay === "string" &&
    run.replay.length > 0 &&
    typeof run.savedAt === "number" &&
    typeof stats === "object" &&
    stats !== null &&
    STAT_KEYS.every((key) => typeof stats[key] === "number")
  );
}
