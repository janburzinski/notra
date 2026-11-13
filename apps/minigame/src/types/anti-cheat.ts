import type { ModelId, RunResult } from "@/types/game";
import type { StoredRun } from "@/types/leaderboard";

/** A heartbeat as the server stored it: when it arrived, and the tick and fingerprint it claimed. */
export interface Beat {
  at: number;
  tick: number;
  hash: number;
}

export type RunVerdict =
  | { ok: true; result: RunResult }
  | { ok: false; reason: string };

/** The run behind a player's best score, kept so anyone can watch it. */
export interface StoredReplay {
  seed: number;
  model: ModelId;
  version: number;
  score: number;
  /** The gzipped input recording, base64url. */
  replay: string;
}

/** A run taken out of the store for submitting, with the heartbeats it collected. */
export interface TakenRun {
  run: StoredRun;
  beats: Beat[];
}

/** Why a player's best is waiting for a moderator: its score and where it landed. */
export interface ReviewItem {
  score: number;
  rank: number;
  at: number;
}

/** What saving a verified run did: a banned player's run changes nothing. */
export type SubmitOutcome = "improved" | "kept" | "banned";

export type ModerationAction = "ban" | "approve";
