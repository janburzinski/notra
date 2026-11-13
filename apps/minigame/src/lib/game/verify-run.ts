import {
  BEAT_MAX_GAP_S,
  FAST_SLACK_S,
  FIRST_BEAT_SLACK_S,
  MAX_PAUSED_S,
  MAX_STALLS,
  MIN_LIVE_RATIO,
  STALL_RATIO,
  STALL_MAX_GAME_S,
  STALL_SLACK_S,
  UNBEATEN_TAIL_S,
} from "@/constants/anti-cheat";
import { TICK_RATE } from "@/constants/game";
import { Game } from "@/lib/game/sim";
import { stateHash } from "@/lib/game/state-hash";
import type { Beat, RunVerdict } from "@/types/anti-cheat";
import type { ModelId } from "@/types/game";
import { decodeInput } from "@/utils/replay";

interface RunToVerify {
  seed: number;
  model: ModelId;
  /** Server time the run was handed out, in ms. */
  createdAt: number;
  ticks: Uint16Array;
  /** Heartbeats as the server received them, with its own receipt time. */
  beats: readonly Beat[];
}

/**
 * Decides whether a submitted run is real. The replay alone proves the score follows from the inputs;
 * the heartbeats prove those inputs were played live, at normal speed, from the moment the run began:
 *
 * - every heartbeat's fingerprint matches the replay at its tick, so the client really was there at the
 *   time the server heard from it, and no part was played at leisure and pasted in later;
 * - game time never runs ahead of wall time (no fast-forwarding) and only falls behind in a few short
 *   gaps (pauses), not across the run (no slow motion);
 * - heartbeats cover the whole run without long holes.
 */
export function verifyRun(run: RunToVerify): RunVerdict {
  const { ticks } = run;
  const total = ticks.length;
  // A slow request can land after the next one; order by tick. Their receipt times stay as they are,
  // so a reordered pair only makes its stretch look faster, never slower.
  const beats = run.beats.toSorted((a, b) => a.tick - b.tick);
  if (beats.some((beat) => beat.tick > total)) {
    return { ok: false, reason: "A heartbeat is ahead of the replay" };
  }

  // replay, checking each heartbeat's fingerprint as its tick comes up
  const game = new Game(run.seed, run.model);
  let next = 0;
  const check = () => {
    while (next < beats.length && beats[next]?.tick === game.ticks) {
      if (beats[next]?.hash !== stateHash(game)) {
        return false;
      }
      next += 1;
    }
    return true;
  };
  if (!check()) {
    return { ok: false, reason: "The replay doesn't match what was played" };
  }
  for (const value of ticks) {
    if (game.over) {
      break;
    }
    game.step(decodeInput(value));
    if (!check()) {
      return { ok: false, reason: "The replay doesn't match what was played" };
    }
  }
  if (!game.over) {
    return { ok: false, reason: "Only finished runs count" };
  }
  if (next < beats.length) {
    return { ok: false, reason: "A heartbeat is past the end of the run" };
  }

  // pacing: game time against the server's clock, from the moment the run was handed out
  const points = [{ at: run.createdAt, tick: 0 }, ...beats];
  let stalls = 0;
  let paused = 0;
  let liveGame = 0;
  let liveWall = 0;
  // Over any stretch between two heartbeats, game time may not exceed wall time. With
  // lead = game time − wall time, that is: no lead may top the lowest lead before it by more than
  // the slack. This catches fast-forwarding and a run computed ahead of time then sent in a burst.
  let lowestLead = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    if (!(prev && point)) {
      continue;
    }
    const dGame = (point.tick - prev.tick) / TICK_RATE;
    const dWall = (point.at - prev.at) / 1000;
    const lead = point.tick / TICK_RATE - (point.at - run.createdAt) / 1000;
    if (lead - lowestLead > FAST_SLACK_S) {
      return { ok: false, reason: "The run went faster than real time" };
    }
    lowestLead = Math.min(lowestLead, lead);
    // The seed is known from the start, so an open-ended wait before the first heartbeat would be
    // time to work out the whole run before playing it. The client reports tick 0 as soon as play
    // begins, so this only allows for a slow request.
    if (i === 1 && dWall - dGame > FIRST_BEAT_SLACK_S) {
      return { ok: false, reason: "The run didn't start right away" };
    }
    if (dGame > BEAT_MAX_GAP_S) {
      return {
        ok: false,
        reason: "The run wasn't reported while it was played",
      };
    }
    if (
      dGame <= STALL_MAX_GAME_S &&
      dGame < dWall * STALL_RATIO - STALL_SLACK_S
    ) {
      // A pause: the client stops reporting while paused, so such a stretch holds at most one
      // heartbeat interval of game time. A longer slow stretch is slow motion and counts as live.
      stalls += 1;
      paused += dWall - dGame;
    } else {
      liveGame += dGame;
      liveWall += dWall;
    }
  }
  if (stalls > MAX_STALLS) {
    return { ok: false, reason: "The run was paused or slowed down too often" };
  }
  if (paused > MAX_PAUSED_S) {
    return { ok: false, reason: "The run was paused for too long" };
  }
  if (liveWall > 0 && liveGame / liveWall < MIN_LIVE_RATIO) {
    return { ok: false, reason: "The run was played in slow motion" };
  }
  const covered = beats.at(-1)?.tick ?? 0;
  if ((total - covered) / TICK_RATE > UNBEATEN_TAIL_S) {
    return { ok: false, reason: "The run wasn't reported while it was played" };
  }

  return {
    ok: true,
    result: { ...game.stats(), model: run.model, over: game.over },
  };
}
