import { describe, expect, test } from "bun:test";

import { MODEL_IDS } from "@/constants/models";
import { REPLAY_VERSION } from "@/constants/replay";
import { autopilotInput } from "@/lib/game/autopilot";
import { replayRun } from "@/lib/game/replay-run";
import { Game } from "@/lib/game/sim";
import type { TickInput } from "@/types/game";
import { datan2, dcos, dsin } from "@/utils/det-math";
import {
  ReplayRecorder,
  decodeInput,
  encodeInput,
  readReplay,
} from "@/utils/replay";
import { createRng } from "@/utils/rng";

/** The menu's autopilot, plus the odd dash and strike so those get replayed too. */
function pilot(game: Game, rng: () => number): TickInput {
  return {
    ...autopilotInput(game),
    dash: rng() < 0.02,
    bomb: rng() < 0.002,
  };
}

describe("replays", () => {
  test("a recorded run replays to the same result for every model", () => {
    for (const model of MODEL_IDS) {
      const seed = 4242 + MODEL_IDS.indexOf(model);
      const game = new Game(seed, model);
      const recorder = new ReplayRecorder();
      const rng = createRng(seed * 31);
      while (!game.over && game.ticks < 60 * 60 * 6) {
        const input = pilot(game, rng);
        recorder.push(encodeInput(input));
        game.step(input);
      }
      const ticks = readReplay(recorder.toBytes());
      expect(ticks).not.toBeNull();
      const result = replayRun(seed, model, ticks ?? new Uint16Array());
      expect(result.score).toBe(game.score);
      expect(result.wave).toBe(game.wave.number);
      expect(result.ticks).toBe(game.ticks);
      expect(result.over).toBe(game.over);
      expect(result.score).toBeGreaterThan(0);
    }
  });

  test("a different seed or model gives a different run", () => {
    const inputs: TickInput[] = Array.from({ length: 60 * 30 }, (_, i) => ({
      steer: (i * 3) % 256,
      steering: i % 17 !== 0,
      throttle: (((i >> 6) % 3) - 1) as -1 | 0 | 1,
      fire: true,
      dash: false,
      bomb: false,
    }));
    const ticks = Uint16Array.from(inputs.map(encodeInput));
    const a = replayRun(1, "claude", ticks);
    const b = replayRun(2, "claude", ticks);
    const c = replayRun(1, "grok", ticks);
    expect([a.score, a.kills, a.ticks]).not.toEqual([
      b.score,
      b.kills,
      b.ticks,
    ]);
    expect([a.score, a.kills, a.ticks]).not.toEqual([
      c.score,
      c.kills,
      c.ticks,
    ]);
  });

  test("every cleared wave grants one upgrade without stopping play", () => {
    const game = new Game(99, "claude");
    let clears = 0;
    while (!game.over && game.wave.number < 4 && game.ticks < 60 * 60 * 5) {
      game.step(autopilotInput(game));
      clears += game.events.filter(
        (event) => event.type === "waveClear"
      ).length;
    }
    const taken = Object.values(game.upgrades).reduce(
      (sum, level) => sum + level,
      0
    );
    expect(clears).toBeGreaterThan(0);
    expect(taken).toBe(clears);
  });

  test("inputs survive encoding", () => {
    const input: TickInput = {
      steer: 201,
      steering: true,
      throttle: -1,
      fire: true,
      dash: false,
      bomb: true,
    };
    expect(decodeInput(encodeInput(input))).toEqual(input);
    expect(
      decodeInput(encodeInput({ ...input, throttle: 1, steering: false }))
    ).toEqual({ ...input, throttle: 1, steering: false });
  });

  test("malformed replays are refused", () => {
    expect(readReplay(Uint8Array.from([99, 1, 1]))).toBeNull();
    expect(readReplay(Uint8Array.from([REPLAY_VERSION, 0x80]))).toBeNull();
    // one value repeated for far longer than a run may last
    expect(
      readReplay(Uint8Array.from([REPLAY_VERSION, 0, 0xff, 0xff, 0xff, 0x0f]))
    ).toBeNull();
  });
});

describe("deterministic math", () => {
  test("stays close to Math", () => {
    for (let a = -20; a <= 20; a += 0.0137) {
      expect(Math.abs(dsin(a) - Math.sin(a))).toBeLessThan(1e-6);
      expect(Math.abs(dcos(a) - Math.cos(a))).toBeLessThan(1e-6);
      const y = Math.sin(a * 1.7) * 3;
      const x = Math.cos(a) * 2;
      expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(2e-5);
    }
  });
});
