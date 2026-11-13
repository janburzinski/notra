import type { GameStats, ModelId } from "@/types/game";

export interface FinishedRun {
  /** Null when the server couldn't start a run, so the score can't be saved. */
  runId: string | null;
  model: ModelId;
  stats: GameStats;
  replay: Uint8Array;
}

export interface SessionCallbacks {
  onOver: (run: FinishedRun) => void;
  onPause: (paused: boolean) => void;
  /** A heartbeat for the server: the run, its tick and the state fingerprint at that tick. */
  onBeat: (runId: string, tick: number, hash: number) => void;
  /** A watched replay reached its end. */
  onReplayEnd: () => void;
}

export type Screen = "menu" | "starting" | "playing" | "over" | "replay";

/** A best run being watched from the leaderboard. */
export interface WatchedRun {
  handle: string;
  score: number;
}

export type MenuTab = "play" | "leaderboard";
