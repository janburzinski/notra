import { BEAT_INTERVAL_S } from "@/constants/anti-cheat";
import { ARENA_H, ARENA_W, DT } from "@/constants/game";
import { MODEL_IDS } from "@/constants/models";
import { Sfx } from "@/lib/game/audio";
import { autopilotInput } from "@/lib/game/autopilot";
import { Backdrop } from "@/lib/game/backdrop";
import { InputController } from "@/lib/game/input";
import { Renderer } from "@/lib/game/renderer";
import { Game } from "@/lib/game/sim";
import { spriteSheet } from "@/lib/game/sprites";
import { stateHash } from "@/lib/game/state-hash";
import type { ModelId } from "@/types/game";
import type { FinishedRun, SessionCallbacks } from "@/types/session";
import { ReplayRecorder, decodeInput, encodeInput } from "@/utils/replay";

/** Seconds of explosion the player sees before the game-over screen. */
const DEATH_PAUSE_S = 1.6;
const MAX_FRAME_S = 0.1;

/**
 * Owns the canvas and the loop. Between runs it plays a demo with the autopilot behind the menu; a
 * real run records every tick's input so the server can replay it, and reports a heartbeat every few
 * seconds so the server knows it was played live. It can also play back a stored run.
 */
export class GameSession {
  readonly canvas: HTMLCanvasElement;
  readonly input: InputController;
  readonly sfx = new Sfx();
  private readonly renderer: Renderer;
  private readonly backdrop = new Backdrop();
  private game: Game | null = null;
  private recorder: ReplayRecorder | null = null;
  private run: { runId: string | null; seed: number; model: ModelId } | null =
    null;
  private frame = 0;
  private last = 0;
  private acc = 0;
  private deathTimer = 0;
  private finished = false;
  private paused = false;
  /** Seconds of live play since the last heartbeat. */
  private beatClock = 0;
  /** Inputs of a run being watched, and how far it has got. */
  private playback: Uint16Array | null = null;
  private playbackIndex = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly offVisibility: () => void;

  private readonly stage: HTMLElement;
  private readonly callbacks: SessionCallbacks;

  constructor(stage: HTMLElement, callbacks: SessionCallbacks) {
    this.stage = stage;
    this.callbacks = callbacks;
    const canvas = document.createElement("canvas");
    canvas.width = ARENA_W;
    canvas.height = ARENA_H;
    canvas.setAttribute("aria-label", "Game screen");
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    // above the backdrop, which is positioned
    canvas.style.position = "relative";
    stage.prepend(canvas);
    stage.prepend(this.backdrop.canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D is not available");
    }
    ctx.imageSmoothingEnabled = false;
    this.renderer = new Renderer(ctx);
    this.renderer.calm = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    this.input = new InputController(stage);
    this.renderer.setSprites(spriteSheet());

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(stage);
    this.fit();

    const onVisibility = () => {
      if (document.hidden && this.recorder && !this.finished) {
        this.setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    this.offVisibility = () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onVisibility);
    };

    this.startDemo();
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.offVisibility();
    this.input.destroy();
    this.canvas.remove();
    this.backdrop.canvas.remove();
  }

  /**
   * Scales the arena as large as the stage allows, even if its pixels come out a fraction uneven, and
   * lets the backdrop fill what is left.
   */
  private fit() {
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    const scale = Math.min(width / ARENA_W, height / ARENA_H);
    this.canvas.style.width = `${ARENA_W * scale}px`;
    this.canvas.style.height = `${ARENA_H * scale}px`;
    this.backdrop.fit(width, height, scale);
  }

  get playing() {
    return this.recorder !== null && !this.finished;
  }

  startDemo() {
    const model =
      MODEL_IDS[Math.floor(Math.random() * MODEL_IDS.length)] ?? "claude";
    this.game = new Game(Math.floor(Math.random() * 2 ** 31), model);
    this.recorder = null;
    this.playback = null;
    this.run = null;
    this.finished = false;
    this.paused = false;
    this.renderer.reset();
  }

  startRun(runId: string | null, seed: number, model: ModelId) {
    this.sfx.unlock();
    this.game = new Game(seed, model);
    this.recorder = new ReplayRecorder();
    this.playback = null;
    this.beatClock = 0;
    this.run = { runId, seed, model };
    this.finished = false;
    this.deathTimer = 0;
    this.acc = 0;
    this.paused = false;
    this.renderer.reset();
    this.callbacks.onPause(false);
    // a heartbeat at tick 0 tells the server play began, so a pause in the first seconds is just a pause
    if (runId) {
      this.callbacks.onBeat(runId, 0, stateHash(this.game));
    }
  }

  /** Plays back a stored run, with sound and HUD, then reports the end. */
  startReplay(seed: number, model: ModelId, ticks: Uint16Array) {
    this.sfx.unlock();
    this.game = new Game(seed, model);
    this.recorder = null;
    this.playback = ticks;
    this.playbackIndex = 0;
    this.run = null;
    this.finished = false;
    this.deathTimer = 0;
    this.acc = 0;
    this.paused = false;
    this.renderer.reset();
  }

  setPaused(paused: boolean) {
    if (!this.recorder || this.finished || this.paused === paused) {
      return;
    }
    this.paused = paused;
    this.input.clearPresses();
    if (!paused) {
      this.sfx.unlock();
      this.last = performance.now();
      this.acc = 0;
    }
    this.callbacks.onPause(paused);
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  private readonly tick = (now: number) => {
    const elapsed = Math.min(MAX_FRAME_S, (now - this.last) / 1000);
    this.last = now;
    const game = this.game;
    if (game && !this.paused) {
      this.acc += elapsed;
      while (this.acc >= DT) {
        this.acc -= DT;
        if (game.over) {
          break;
        }
        const input = this.nextInput(game);
        if (!input) {
          break;
        }
        this.recorder?.push(encodeInput(input));
        this.renderer.capture(game);
        game.step(input);
        this.renderer.consume(game.events, game);
        if (this.recorder || this.playback) {
          this.sfx.play(game.events);
        }
      }
      this.heartbeat(game, elapsed);
      if (game.over) {
        this.acc = 0;
        this.deathTimer += elapsed;
        if (this.deathTimer >= DEATH_PAUSE_S) {
          this.deathTimer = 0;
          if (this.recorder && !this.finished) {
            this.finish(game);
          } else if (this.playback && !this.finished) {
            this.finished = true;
            this.callbacks.onReplayEnd();
          } else if (!(this.recorder || this.playback)) {
            this.startDemo();
          }
        }
      }
      this.renderer.alpha = game.over ? 1 : this.acc / DT;
      this.renderer.update(elapsed, game);
      this.backdrop.update(elapsed);
    }
    const overlay = this.input.overlay(
      this.canvas,
      this.recorder !== null || this.playback !== null,
      this.paused || this.playback !== null
    );
    this.backdrop.render(game && !game.over ? overlay.reticle : null);
    this.renderer.render(game, overlay);
    this.frame = requestAnimationFrame(this.tick);
  };

  /** The next tick's input: the player's, the recording's, or the autopilot's in the demo. */
  private nextInput(game: Game) {
    if (this.recorder) {
      return this.input.sample(game.player, this.canvas);
    }
    if (this.playback) {
      const value = this.playback[this.playbackIndex];
      if (value === undefined) {
        // a recording always ends in a death; one that doesn't is cut short, so end it here
        if (!this.finished) {
          this.finished = true;
          this.callbacks.onReplayEnd();
        }
        return null;
      }
      this.playbackIndex += 1;
      return decodeInput(value);
    }
    return autopilotInput(game);
  }

  /** Every few seconds of live play, tells the server where the run is. */
  private heartbeat(game: Game, elapsed: number) {
    const runId = this.run?.runId;
    if (!(runId && this.recorder) || this.finished || game.over) {
      return;
    }
    this.beatClock += elapsed;
    if (this.beatClock >= BEAT_INTERVAL_S) {
      this.beatClock = 0;
      this.callbacks.onBeat(runId, game.ticks, stateHash(game));
    }
  }

  private finish(game: Game) {
    this.finished = true;
    const run = this.run;
    const recorder = this.recorder;
    if (!(run && recorder)) {
      return;
    }
    const result: FinishedRun = {
      runId: run.runId,
      model: run.model,
      stats: game.stats(),
      replay: recorder.toBytes(),
    };
    this.callbacks.onOver(result);
  }
}
