import type { GameEvent } from "@/types/game";

/**
 * Chiptune sound effects synthesised with Web Audio, so there are no audio files to load. The context
 * is created on the first user gesture, which browsers require.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastShot = 0;
  private lastEnemyShot = 0;
  private lastHit = 0;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => undefined);
      }
      return;
    }
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) {
      return;
    }
    const ctx = new Context();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.22;
    master.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.random() * 2 - 1;
    }
    this.ctx = ctx;
    this.master = master;
    this.noise = buffer;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.22,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  private tone(
    from: number,
    to: number,
    seconds: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const { ctx, master } = this;
    if (!(ctx && master) || this.muted) {
      return;
    }
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, to),
      start + seconds
    );
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  private hiss(
    seconds: number,
    volume: number,
    cutoff: number,
    sweepTo = cutoff
  ) {
    const { ctx, master, noise } = this;
    if (!(ctx && master && noise) || this.muted) {
      return;
    }
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, sweepTo),
      start + seconds
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random() * 0.5);
    source.stop(start + seconds + 0.02);
  }

  play(events: readonly GameEvent[]) {
    if (!this.ctx || this.muted) {
      return;
    }
    const now = this.ctx.currentTime;
    for (const event of events) {
      switch (event.type) {
        case "shot":
          if (event.owner === "player") {
            if (now - this.lastShot > 0.06) {
              this.lastShot = now;
              this.tone(880, 440, 0.06, "square", 0.07);
            }
          } else if (now - this.lastEnemyShot > 0.09) {
            this.lastEnemyShot = now;
            this.tone(330, 180, 0.08, "triangle", 0.08);
          }
          break;
        case "hit":
        case "bossHit":
          if (now - this.lastHit > 0.05) {
            this.lastHit = now;
            this.hiss(0.05, 0.12, 3000);
          }
          break;
        case "kill":
          this.hiss(0.35, 0.35, 2200, 200);
          this.tone(220, 55, 0.25, "square", 0.12);
          break;
        case "playerHit":
          this.tone(300, 60, 0.35, "sawtooth", 0.25);
          this.hiss(0.3, 0.3, 1500, 100);
          break;
        case "shieldBreak":
          this.tone(1200, 300, 0.25, "triangle", 0.2);
          break;
        case "playerDeath":
          this.hiss(1.2, 0.5, 1800, 60);
          this.tone(400, 30, 1.1, "sawtooth", 0.25);
          break;
        case "upgrade":
          for (let i = 0; i < 4; i += 1) {
            this.tone(
              523 * 1.25 ** i,
              523 * 1.25 ** i,
              0.08,
              "square",
              0.12,
              i * 0.06
            );
          }
          break;
        case "ram":
          this.hiss(0.18, 0.35, 1200, 120);
          this.tone(120, 50, 0.16, "square", 0.2);
          break;
        case "dash":
          this.hiss(0.15, 0.18, 6000, 800);
          break;
        case "bomb":
          this.hiss(0.9, 0.55, 4000, 80);
          this.tone(160, 40, 0.8, "square", 0.25);
          break;
        case "pickup":
          this.tone(660, 660, 0.07, "square", 0.12);
          this.tone(990, 990, 0.07, "square", 0.12, 0.07);
          this.tone(1320, 1320, 0.1, "square", 0.12, 0.14);
          break;
        case "wave":
          if (event.boss) {
            for (let i = 0; i < 3; i += 1) {
              this.tone(220, 180, 0.3, "sawtooth", 0.16, i * 0.4);
            }
          } else {
            this.tone(440, 440, 0.1, "square", 0.12);
            this.tone(660, 660, 0.16, "square", 0.12, 0.1);
          }
          break;
        case "waveClear":
          this.tone(523, 523, 0.1, "square", 0.12);
          this.tone(659, 659, 0.1, "square", 0.12, 0.1);
          this.tone(784, 784, 0.2, "square", 0.12, 0.2);
          if (event.perfect) {
            this.tone(1047, 1047, 0.25, "square", 0.12, 0.32);
          }
          break;
        case "bossBlast":
          this.hiss(0.3, 0.3, 1800, 150);
          break;
        case "bossDeath":
          this.hiss(1.6, 0.6, 2500, 40);
          this.tone(200, 25, 1.4, "square", 0.3);
          break;
        case "bossAttack":
          this.tone(140, 260, 0.18, "sawtooth", 0.1);
          break;
        default:
          break;
      }
    }
  }
}
