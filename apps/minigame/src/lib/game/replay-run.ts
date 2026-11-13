import { Game } from "@/lib/game/sim";
import type { ModelId, RunResult } from "@/types/game";
import { decodeInput } from "@/utils/replay";

/** Plays a recorded run back from its seed and returns where it ended. */
export function replayRun(
  seed: number,
  model: ModelId,
  ticks: Uint16Array
): RunResult {
  const game = new Game(seed, model);
  for (const value of ticks) {
    if (game.over) {
      break;
    }
    game.step(decodeInput(value));
  }
  return { ...game.stats(), model, over: game.over };
}
