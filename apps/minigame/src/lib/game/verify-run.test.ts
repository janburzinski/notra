import { describe, expect, test } from "bun:test";

import { BEAT_INTERVAL_S } from "@/constants/anti-cheat";
import { TICK_RATE } from "@/constants/game";
import { autopilotInput } from "@/lib/game/autopilot";
import { Game } from "@/lib/game/sim";
import { stateHash } from "@/lib/game/state-hash";
import { verifyRun } from "@/lib/game/verify-run";
import type { Beat } from "@/types/anti-cheat";
import { encodeInput } from "@/utils/replay";

const SEED = 314;
const CREATED = 1_800_000_000_000;
const EVERY = BEAT_INTERVAL_S * TICK_RATE;

/** Plays a whole run and records a heartbeat (tick + fingerprint) every few seconds of game time. */
function playRun() {
  const game = new Game(SEED, "claude");
  const inputs: number[] = [];
  const marks: { tick: number; hash: number }[] = [];
  while (!game.over && game.ticks < 60 * 60 * 8) {
    const input = autopilotInput(game);
    inputs.push(encodeInput(input));
    game.step(input);
    if (game.ticks % EVERY === 0 && !game.over) {
      marks.push({ tick: game.ticks, hash: stateHash(game) });
    }
  }
  return { ticks: Uint16Array.from(inputs), marks, over: game.over };
}

const played = playRun();

/** Stamps each heartbeat with a server time: real time, `pace` times slower, plus pauses. */
function stamp(
  pace = 1,
  pauses: Record<number, number> = {},
  latencyMs = 80
): Beat[] {
  let paused = 0;
  return played.marks.map((mark, index) => {
    paused += (pauses[index] ?? 0) * 1000;
    return {
      ...mark,
      at: CREATED + (mark.tick / TICK_RATE) * 1000 * pace + paused + latencyMs,
    };
  });
}

function verify(beats: Beat[], ticks = played.ticks) {
  return verifyRun({
    seed: SEED,
    model: "claude",
    createdAt: CREATED,
    ticks,
    beats,
  });
}

describe("run verification", () => {
  test("the sample run is long enough to mean something", () => {
    expect(played.over).toBe(true);
    expect(played.marks.length).toBeGreaterThan(5);
  });

  test("an honest run passes, pauses and network jitter included", () => {
    const verdict = verify(stamp(1, { 1: 45, 3: 8, 4: 120 }));
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.result.score).toBeGreaterThan(0);
    }
    const jittery = stamp().map((beat, index) => ({
      ...beat,
      at: beat.at + (index % 2 === 0 ? 900 : -300),
    }));
    expect(verify(jittery).ok).toBe(true);
  });

  test("slow motion is caught", () => {
    expect(verify(stamp(1.6))).toMatchObject({ ok: false });
    expect(verify(stamp(2.5))).toMatchObject({ ok: false });
  });

  test("fast forward is caught", () => {
    expect(verify(stamp(0.5))).toMatchObject({ ok: false });
  });

  test("a run computed ahead of time and played back late is caught", () => {
    // everything arrives in one burst long after the run was handed out
    const late = played.marks.map((mark) => ({
      ...mark,
      at: CREATED + 3_600_000,
    }));
    expect(verify(late)).toMatchObject({ ok: false });
  });

  test("a fingerprint that doesn't match the replay is caught", () => {
    const beats = stamp();
    const forged = beats.map((beat, index) =>
      index === 2 ? { ...beat, hash: (beat.hash + 1) >>> 0 } : beat
    );
    expect(verify(forged)).toMatchObject({ ok: false });
  });

  test("a different replay under the same heartbeats is caught", () => {
    const edited = Uint16Array.from(played.ticks);
    edited[30] = (edited[30] ?? 0) ^ (1 << 11);
    edited[31] = (edited[31] ?? 0) ^ (1 << 12);
    expect(verify(stamp(), edited)).toMatchObject({ ok: false });
  });

  test("a run without heartbeats, or with a long silent stretch, is caught", () => {
    expect(verify([])).toMatchObject({ ok: false });
    const holey = stamp().filter((_, index) => index < 2 || index > 8);
    expect(verify(holey)).toMatchObject({ ok: false });
  });

  test("too many pauses are caught", () => {
    const pauses = Object.fromEntries(
      played.marks.map((_, index) => [index, 20])
    );
    expect(verify(stamp(1, pauses))).toMatchObject({ ok: false });
  });

  test("a heartbeat that arrives after the next one still passes", () => {
    const beats = stamp();
    const [second, third] = [beats[2], beats[3]];
    if (!(second && third)) {
      throw new Error("run too short");
    }
    const reordered = [
      ...beats.slice(0, 2),
      third,
      { ...second, at: third.at + 200 },
      ...beats.slice(4),
    ];
    expect(verify(reordered).ok).toBe(true);
  });

  test("slow motion between sparse heartbeats is caught", () => {
    // fewer heartbeats make every gap long enough to pass for a pause
    const sparse = stamp(1.5).filter((_, index) => index % 4 === 3);
    expect(verify(sparse)).toMatchObject({ ok: false });
  });

  test("a pause right after the start heartbeat passes", () => {
    const start = {
      tick: 0,
      hash: stateHash(new Game(SEED, "claude")),
      at: CREATED + 150,
    };
    expect(verify([start, ...stamp(1, { 0: 60 })]).ok).toBe(true);
  });

  test("a long wait before the first heartbeat is caught", () => {
    const beats = stamp().map((beat) => ({ ...beat, at: beat.at + 600_000 }));
    expect(verify(beats)).toMatchObject({ ok: false });
  });
});
