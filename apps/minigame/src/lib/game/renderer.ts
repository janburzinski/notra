import {
  ARENA_H,
  ARENA_W,
  BOMB_RADIUS,
  BOSS_FRAMES,
  BOSS_SIZE,
  CHARGE_WINDUP_S,
  COMBO_WINDOW_S,
  DANGER,
  GOLD,
  MAX_BOMBS,
  NOTRA_VIOLET,
  OVERDRIVE_S,
  PICKUP_LIFE_S,
  SPAWN_WARNING_S,
  SPRITE_SIZE,
  WHITE,
} from "@/constants/game";
import { MODELS } from "@/constants/models";
import { GLYPH_H, GLYPH_W, GLYPHS } from "@/constants/pixel-font";
import {
  FIRE,
  PICKUP_COLORS,
  PICKUP_ICONS,
  PICKUP_LABELS,
  SMOKE,
  SPACE,
  STAR,
  SHAKE_STEP_S,
  STAR_COUNT,
  TRAIL_LENGTH,
  TRAIL_STEP_S,
  UPGRADE_BANNER_S,
} from "@/constants/render";
import { UPGRADES } from "@/constants/upgrades";
import type { Game } from "@/lib/game/sim";
import type { GameEvent, ModelId, Rgb } from "@/types/game";
import type {
  Banner,
  Floater,
  Ghost,
  Overlay,
  Particle,
  Ring,
  SpriteSheet,
  Star,
  Tone,
} from "@/types/render";
import { modelSpec } from "@/utils/models";
import { upgradeSpec } from "@/utils/upgrades";

const MODEL_COLORS = Object.fromEntries(
  MODELS.map((model) => [model.id, model.color])
) as Record<ModelId, Rgb>;

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgba([r, g, b]: Rgb, alpha: number) {
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/** Text width in art pixels at scale 1. */
function textWidth(text: string) {
  return text.length === 0 ? 0 : text.length * (GLYPH_W + 1) - 1;
}

/**
 * Draws a game on a canvas that is exactly ARENA_W × ARENA_H and scaled up without smoothing. Every
 * loose pixel goes into one ImageData uploaded once per frame; only sprites are drawn as images.
 * Particles, trails and popups live here, outside the simulation, and use Math.random freely.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frame: ImageData;
  private sprites: SpriteSheet | null = null;
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private ghosts: Ghost[] = [];
  private banner: Banner | null = null;
  private readonly stars: Star[];
  private readonly trails = new Map<number, { x: number; y: number }[]>();
  private trailClock = 0;
  private time = 0;
  private flashScreen = 0;
  shake = 0;
  /** The current shake offset; it changes SHAKE_STEP_S at a time so it looks the same at any frame rate. */
  private shakeOffset = { x: 0, y: 0 };
  private shakeClock = 0;
  /** Where every moving thing was before the last tick, to draw it between ticks. */
  private prev = new WeakMap<object, { x: number; y: number }>();
  /** How far the display is between the last two ticks, 0–1. */
  alpha = 1;
  /** Reduced motion: no screen shake and no full-screen flashes. */
  calm = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.frame = ctx.createImageData(ARENA_W, ARENA_H);
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * ARENA_W,
      y: Math.random() * ARENA_H,
      depth: Math.random() * Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  setSprites(sprites: SpriteSheet) {
    this.sprites = sprites;
  }

  /** Clears effects when a new run starts. */
  reset() {
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.ghosts = [];
    this.banner = null;
    this.trails.clear();
    this.shake = 0;
    this.flashScreen = 0;
    this.prev = new WeakMap();
  }

  /**
   * Called before every simulation tick: remembers where things are, so frames that land between two
   * ticks can be drawn in between. Dash afterimages are dropped here too, once per tick.
   */
  capture(game: Game) {
    const keep = (body: { x: number; y: number }) => {
      const entry = this.prev.get(body);
      if (entry) {
        entry.x = body.x;
        entry.y = body.y;
      } else {
        this.prev.set(body, { x: body.x, y: body.y });
      }
    };
    keep(game.player);
    for (const list of [game.enemies, game.bullets, game.pickups]) {
      for (const body of list) {
        keep(body);
      }
    }
    if (game.boss) {
      keep(game.boss);
    }
    const p = game.player;
    if (p.dashTime > 0 && !game.over) {
      this.ghosts.push({ model: game.spec.id, x: p.x, y: p.y, life: 0.2 });
    }
  }

  /** A body drawn between its last two ticks. */
  private between<T extends { x: number; y: number }>(body: T): T {
    const from = this.prev.get(body);
    if (!from || this.alpha >= 1) {
      return body;
    }
    return {
      ...body,
      x: from.x + (body.x - from.x) * this.alpha,
      y: from.y + (body.y - from.y) * this.alpha,
    };
  }

  /** The game as it should look right now: the same state with every body placed between ticks. */
  private interpolated(game: Game): Game {
    return Object.assign(Object.create(game) as Game, {
      player: this.between(game.player),
      enemies: game.enemies.map((enemy) => this.between(enemy)),
      bullets: game.bullets.map((bullet) => this.between(bullet)),
      pickups: game.pickups.map((pickup) => this.between(pickup)),
      boss: game.boss ? this.between(game.boss) : null,
    });
  }

  showBanner(title: string, sub: string, color: Rgb = WHITE, seconds = 2) {
    this.banner = { title, sub, life: seconds, max: seconds, color };
  }

  // ---------------------------------------------------------------- effects

  /** Turns what the simulation reported this tick into sparks, rings and popups. */
  consume(events: readonly GameEvent[], game: Game) {
    for (const event of events) {
      switch (event.type) {
        case "shot":
          if (event.owner === "enemy") {
            this.burst(event.x, event.y, 2, 10, [WHITE, event.model], 0.12);
          }
          break;
        case "hit":
          this.burst(
            event.x,
            event.y,
            4,
            35,
            [WHITE, FIRE[1] ?? WHITE, event.model],
            0.3
          );
          break;
        case "kill":
          this.blast(event.x, event.y, event.model, 1);
          this.debris(event.x, event.y, event.model, 6);
          this.float(
            `+${event.points}`,
            event.x,
            event.y - 8,
            game.multiplier > 1 ? GOLD : WHITE
          );
          this.shake = Math.max(this.shake, 0.5);
          break;
        case "playerHit":
          this.blast(event.x, event.y, game.spec.id, 0.6);
          this.flashScreen = 0.18;
          this.shake = Math.max(this.shake, 2);
          this.float("-1 HP", event.x, event.y - 10, DANGER);
          break;
        case "shieldBreak":
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.5,
            max: 0.5,
            r: 16,
            tone: PICKUP_COLORS.shield,
          });
          this.burst(
            event.x,
            event.y,
            16,
            50,
            [PICKUP_COLORS.shield, WHITE],
            0.5
          );
          this.shake = Math.max(this.shake, 1);
          break;
        case "playerDeath":
          this.blast(event.x, event.y, game.spec.id, 2.2);
          this.debris(event.x, event.y, game.spec.id, 14);
          this.shake = 3;
          break;
        case "dash":
          this.burst(event.x, event.y, 6, 30, [WHITE, game.spec.id], 0.3);
          break;
        case "bomb":
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.3,
            max: 0.3,
            r: 14,
            tone: WHITE,
          });
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.7,
            max: 0.7,
            r: BOMB_RADIUS,
            tone: NOTRA_VIOLET,
          });
          this.burst(
            event.x,
            event.y,
            40,
            120,
            [NOTRA_VIOLET, WHITE, NOTRA_VIOLET],
            0.6
          );
          this.flashScreen = 0.12;
          this.shake = Math.max(this.shake, 2.5);
          if (event.cleared > 0) {
            this.float(
              `+${event.cleared * 10}`,
              event.x,
              event.y - 14,
              NOTRA_VIOLET
            );
          }
          break;
        case "fizzle":
          this.burst(event.x, event.y, 2, 14, [event.model, WHITE], 0.3);
          break;
        case "pickup":
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.35,
            max: 0.35,
            r: 10,
            tone: PICKUP_COLORS[event.kind],
          });
          this.float(
            event.points > 0 ? `+${event.points}` : PICKUP_LABELS[event.kind],
            event.x,
            event.y - 10,
            PICKUP_COLORS[event.kind]
          );
          break;
        case "wave":
          if (event.boss) {
            this.showBanner(
              "WARNING",
              `GIANT ${modelSpec(event.boss).name.toUpperCase()} INCOMING`,
              DANGER,
              2.6
            );
          } else if (event.kind === "swarm" && event.swarm) {
            this.showBanner(
              `WAVE ${event.number}: SWARM`,
              `A FLOOD OF WEAK ${modelSpec(event.swarm).name.toUpperCase()}S`,
              MODEL_COLORS[event.swarm],
              2.2
            );
          } else if (event.kind === "aces") {
            this.showBanner(
              `WAVE ${event.number}: ACES`,
              "FEW, TOUGH, 3X POINTS. DON'T RAM THEM",
              GOLD,
              2.2
            );
          } else {
            this.showBanner(
              `WAVE ${event.number}`,
              waveHint(event.number, game),
              WHITE,
              1.8
            );
          }
          break;
        case "upgrade": {
          const spec = upgradeSpec(event.id);
          // it comes with the wave-clear banner, which says what the ship just got
          if (this.banner) {
            this.banner.sub = `${this.banner.sub}   ${spec.name.toUpperCase()} (${spec.effect.toUpperCase()})`;
            this.banner.life = UPGRADE_BANNER_S;
            this.banner.max = UPGRADE_BANNER_S;
          }
          this.float(
            spec.name.toUpperCase(),
            game.player.x,
            game.player.y - 14,
            spec.color
          );
          this.rings.push({
            x: game.player.x,
            y: game.player.y,
            life: 0.5,
            max: 0.5,
            r: 18,
            tone: spec.color,
          });
          break;
        }
        case "ram":
          this.burst(
            event.x,
            event.y,
            12,
            60,
            [WHITE, ...FIRE.slice(0, 2)],
            0.35
          );
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.25,
            max: 0.25,
            r: 9,
            tone: WHITE,
          });
          this.shake = Math.max(this.shake, 1.2);
          break;
        case "waveClear":
          this.showBanner(
            event.perfect ? "PERFECT!" : "WAVE CLEAR",
            `+${event.points}`,
            event.perfect ? GOLD : WHITE,
            1.8
          );
          break;
        case "bossHit":
          this.burst(
            event.x,
            event.y,
            3,
            40,
            [WHITE, ...FIRE.slice(0, 2)],
            0.3
          );
          break;
        case "bossBlast":
          this.blast(event.x, event.y, game.boss?.model ?? game.spec.id, 0.6);
          this.shake = Math.max(this.shake, 1.4);
          break;
        case "bossDeath":
          this.blast(event.x, event.y, event.model, 3);
          this.debris(event.x, event.y, event.model, 26);
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 1.1,
            max: 1.1,
            r: 90,
            tone: WHITE,
          });
          this.float(`+${event.points}`, event.x, event.y - 18, GOLD);
          this.flashScreen = 0.25;
          this.shake = 4;
          break;
        case "bossAttack":
          this.rings.push({
            x: event.x,
            y: event.y,
            life: 0.25,
            max: 0.25,
            r: 20,
            tone: WHITE,
          });
          break;
        default:
          break;
      }
    }
  }

  private float(text: string, x: number, y: number, color: Rgb) {
    this.floaters.push({ text, x, y, life: 0.9, max: 0.9, color });
  }

  private burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    tones: Tone[],
    life: number
  ) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.75);
      const l = life * (0.5 + Math.random() * 0.8);
      this.particles.push({
        size: 1,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: l,
        max: l,
        tone: tones[i % tones.length] ?? WHITE,
      });
    }
  }

  private blast(x: number, y: number, tone: Tone, scale: number) {
    this.burst(x, y, Math.round(26 * scale), 70 * scale, [...FIRE], 0.7);
    this.burst(x, y, Math.round(8 * scale), 20 * scale, [SMOKE], 1.3);
    this.rings.push({ x, y, life: 0.3, max: 0.3, r: 9 * scale, tone: WHITE });
    this.rings.push({ x, y, life: 0.6, max: 0.6, r: 18 * scale, tone });
  }

  private debris(x: number, y: number, tone: Tone, count: number) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 20 + Math.random() * 40;
      const life = 0.7 + Math.random() * 0.7;
      this.particles.push({
        size: 2,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        tone,
      });
    }
  }

  /** Advances effects by real time; they keep moving while the game is paused for a death. */
  update(dt: number, game: Game | null) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 8);
    // a new shake offset 30 times a second, in whole art pixels
    this.shakeClock -= dt;
    if (this.shakeClock <= 0) {
      this.shakeClock = SHAKE_STEP_S;
      const amount = Math.round(this.shake);
      this.shakeOffset = {
        x: Math.round((Math.random() * 2 - 1) * amount),
        y: Math.round((Math.random() * 2 - 1) * amount),
      };
    }
    this.flashScreen = Math.max(0, this.flashScreen - dt);
    for (const star of this.stars) {
      star.x -= (3 + star.depth * 10) * dt;
      if (star.x < 0) {
        star.x += ARENA_W;
        star.y = Math.random() * ARENA_H;
      }
    }
    const drag = 1 - 2.4 * dt;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      return p.life > 0;
    });
    this.rings = this.rings.filter((ring) => {
      ring.life -= dt;
      return ring.life > 0;
    });
    this.floaters = this.floaters.filter((floater) => {
      floater.life -= dt;
      floater.y -= 14 * dt;
      return floater.life > 0;
    });
    this.ghosts = this.ghosts.filter((ghost) => {
      ghost.life -= dt;
      return ghost.life > 0;
    });
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) {
        this.banner = null;
      }
    }
    if (!game) {
      return;
    }
    const p = game.player;
    this.trailClock -= dt;
    if (this.trailClock <= 0) {
      this.trailClock = TRAIL_STEP_S;
      const alive = new Set<number>([0]);
      const sample = (id: number, x: number, y: number, heading: number) => {
        alive.add(id);
        const trail = this.trails.get(id) ?? [];
        trail.push({
          x: x - Math.cos(heading) * 6,
          y: y - Math.sin(heading) * 6,
        });
        if (trail.length > TRAIL_LENGTH) {
          trail.shift();
        }
        this.trails.set(id, trail);
      };
      if (game.over) {
        this.trails.get(0)?.shift();
      } else {
        sample(0, p.x, p.y, p.heading);
      }
      for (const enemy of game.enemies) {
        sample(enemy.id, enemy.x, enemy.y, enemy.heading);
      }
      for (const id of this.trails.keys()) {
        if (!alive.has(id)) {
          this.trails.delete(id);
        }
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  render(current: Game | null, overlay: Overlay) {
    const game = current ? this.interpolated(current) : null;
    const ctx = this.ctx;
    const data = this.frame.data;
    const W = ARENA_W;
    const H = ARENA_H;
    // fill with space, then plot onto it
    for (let i = 0; i < data.length; i += 4) {
      data[i] = SPACE[0];
      data[i + 1] = SPACE[1];
      data[i + 2] = SPACE[2];
      data[i + 3] = 255;
    }
    const plot = (x: number, y: number, rgb: Rgb, alpha = 1, size = 1) => {
      if (alpha <= 0) {
        return;
      }
      const a = Math.min(1, alpha);
      const px = Math.round(x);
      const py = Math.round(y);
      for (let oy = 0; oy < size; oy += 1) {
        for (let ox = 0; ox < size; ox += 1) {
          const tx = px + ox;
          const ty = py + oy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) {
            continue;
          }
          const i = (ty * W + tx) * 4;
          const below = ((data[i + 3] ?? 0) / 255) * (1 - a);
          const out = a + below;
          data[i] = (rgb[0] * a + (data[i] ?? 0) * below) / out;
          data[i + 1] = (rgb[1] * a + (data[i + 1] ?? 0) * below) / out;
          data[i + 2] = (rgb[2] * a + (data[i + 2] ?? 0) * below) / out;
          data[i + 3] = out * 255;
        }
      }
    };
    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      rgb: Rgb,
      alpha = 1
    ) => {
      for (let yy = 0; yy < h; yy += 1) {
        for (let xx = 0; xx < w; xx += 1) {
          plot(x + xx, y + yy, rgb, alpha);
        }
      }
    };
    const text = (
      value: string,
      x: number,
      y: number,
      rgb: Rgb,
      scale = 1,
      alpha = 1,
      shadow = true
    ) => {
      let cx = Math.round(x);
      const cy = Math.round(y);
      for (const ch of value) {
        const glyph = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[" "];
        if (glyph) {
          for (let gy = 0; gy < GLYPH_H; gy += 1) {
            const row = glyph[gy] ?? "";
            for (let gx = 0; gx < GLYPH_W; gx += 1) {
              if (row[gx] !== "#") {
                continue;
              }
              if (shadow) {
                rect(
                  cx + gx * scale + 1,
                  cy + gy * scale + 1,
                  scale,
                  scale,
                  SPACE,
                  alpha * 0.85
                );
              }
              rect(cx + gx * scale, cy + gy * scale, scale, scale, rgb, alpha);
            }
          }
        }
        cx += (GLYPH_W + 1) * scale;
      }
    };
    const tone = (value: Tone): Rgb =>
      typeof value === "string" ? MODEL_COLORS[value] : value;
    const line = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      rgb: Rgb,
      alpha: number,
      dash = 0
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const steps = Math.max(
        1,
        Math.round(Math.max(Math.abs(dx), Math.abs(dy)))
      );
      for (let i = 0; i <= steps; i += 1) {
        if (dash > 0 && Math.floor(i / dash) % 2 === 1) {
          continue;
        }
        plot(x0 + (dx * i) / steps, y0 + (dy * i) / steps, rgb, alpha);
      }
    };
    const circle = (
      x: number,
      y: number,
      r: number,
      rgb: Rgb,
      alpha: number,
      dotted = false
    ) => {
      const steps = Math.max(12, Math.round(r * 6.5));
      for (let i = 0; i < steps; i += 1) {
        if (dotted && i % 3 === 0) {
          continue;
        }
        const a = (i / steps) * Math.PI * 2;
        plot(x + Math.cos(a) * r, y + Math.sin(a) * r, rgb, alpha);
      }
    };

    for (const star of this.stars) {
      const twinkle = 0.7 + 0.3 * Math.sin(star.phase + this.time * 1.8);
      plot(star.x, star.y, STAR, (0.12 + 0.6 * star.depth) * twinkle);
    }

    if (game) {
      // spawn warnings at the edge
      for (const spawn of game.pending) {
        const blink = Math.floor(spawn.delay * 8) % 2 === 0;
        const t = 1 - spawn.delay / SPAWN_WARNING_S;
        const x = Math.min(W - 5, Math.max(4, spawn.x));
        const y = Math.min(H - 5, Math.max(4, spawn.y));
        const color = MODEL_COLORS[spawn.model];
        const inward = Math.atan2(H / 2 - y, W / 2 - x);
        if (blink) {
          for (let i = 0; i < 4; i += 1) {
            const s = 3 - i;
            const cx = x + Math.cos(inward) * i;
            const cy = y + Math.sin(inward) * i;
            plot(
              cx + Math.cos(inward + Math.PI / 2) * s,
              cy + Math.sin(inward + Math.PI / 2) * s,
              color,
              0.9
            );
            plot(
              cx - Math.cos(inward + Math.PI / 2) * s,
              cy - Math.sin(inward + Math.PI / 2) * s,
              color,
              0.9
            );
          }
        }
        circle(x, y, 2 + t * 5, color, 0.5 * (1 - t));
      }

      // engine trails
      const enemyModels = new Map(game.enemies.map((e) => [e.id, e.model]));
      for (const [id, trail] of this.trails) {
        const model = id === 0 ? game.spec.id : enemyModels.get(id);
        if (!model || trail.length < 2) {
          continue;
        }
        const rgb = MODEL_COLORS[model];
        for (let i = 1; i < trail.length; i += 1) {
          const from = trail[i - 1];
          const to = trail[i];
          if (from && to) {
            line(from.x, from.y, to.x, to.y, rgb, (i / trail.length) * 0.45);
          }
        }
      }

      // charger windups get a dotted line so you can see the ram coming
      for (const enemy of game.enemies) {
        if (enemy.mode === "windup") {
          const t = 1 - enemy.modeTime / CHARGE_WINDUP_S;
          const angle = Math.atan2(
            game.player.y - enemy.y,
            game.player.x - enemy.x
          );
          line(
            enemy.x,
            enemy.y,
            enemy.x + Math.cos(angle) * 150,
            enemy.y + Math.sin(angle) * 150,
            DANGER,
            0.25 + t * 0.5,
            2
          );
        }
      }
    }

    for (const ring of this.rings) {
      const t = 1 - ring.life / ring.max;
      circle(
        ring.x,
        ring.y,
        ring.r * (0.2 + 0.8 * Math.sqrt(t)),
        tone(ring.tone),
        (1 - t) * 0.9
      );
    }
    for (const p of this.particles) {
      plot(p.x, p.y, tone(p.tone), p.life / p.max, p.size);
    }

    if (game) {
      // pickups
      for (const pickup of game.pickups) {
        if (pickup.life < 2 && Math.floor(pickup.life * 8) % 2 === 0) {
          continue;
        }
        const icon = PICKUP_ICONS[pickup.kind];
        const color = PICKUP_COLORS[pickup.kind];
        const bob = Math.round(Math.sin(pickup.life * 5));
        const x0 = Math.round(pickup.x) - 4;
        const y0 = Math.round(pickup.y) - 4 + bob;
        rect(x0 - 1, y0 - 1, 11, 11, SPACE, 0.85);
        for (let i = 0; i < 9; i += 1) {
          plot(x0 - 1 + i + 1, y0 - 1, color, 0.6);
          plot(x0 - 1 + i + 1, y0 + 9, color, 0.6);
          plot(x0 - 1, y0 + i, color, 0.6);
          plot(x0 + 9, y0 + i, color, 0.6);
        }
        icon.forEach((row, gy) => {
          for (let gx = 0; gx < row.length; gx += 1) {
            if (row[gx] === "#") {
              plot(x0 + 1 + gx, y0 + 1 + gy, color, 1);
            }
          }
        });
        const life = pickup.life / PICKUP_LIFE_S;
        rect(x0, y0 + 11, Math.max(1, Math.round(9 * life)), 1, color, 0.6);
      }

      // bullets
      for (const b of game.bullets) {
        const rgb = MODEL_COLORS[b.model];
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const ux = b.vx / speed;
        const uy = b.vy / speed;
        if (b.owner === "enemy") {
          // round pellets with a white core: the things to dodge must read instantly
          const r = b.heavy ? 2 : Math.max(1, Math.round(b.radius - 0.5));
          plot(b.x - ux * 2, b.y - uy * 2, rgb, 0.45, 2);
          for (let oy = -r; oy <= r; oy += 1) {
            for (let ox = -r; ox <= r; ox += 1) {
              if (ox * ox + oy * oy <= r * r + 0.5) {
                plot(b.x + ox, b.y + oy, rgb, 1);
              }
            }
          }
          plot(b.x, b.y, WHITE, 1);
          if (b.homing > 0) {
            circle(b.x, b.y, r + 1.5, rgb, 0.4);
          }
          continue;
        }
        const head = mix(rgb, WHITE, 0.65);
        const length = b.radius >= 2 ? 7 : 5;
        for (let i = length - 1; i >= 0; i -= 1) {
          const color = i < 2 ? head : rgb;
          plot(
            b.x - ux * i,
            b.y - uy * i,
            color,
            i < 2 ? 1 : 1 - i / (length + 1),
            b.radius >= 2.5 && i < 3 ? 2 : 1
          );
        }
      }

      // thrusters behind ships
      const half = Math.floor(SPRITE_SIZE / 2);
      const thruster = (
        x: number,
        y: number,
        heading: number,
        power: number
      ) => {
        const ux = Math.cos(heading);
        const uy = Math.sin(heading);
        const length = 2 + Math.round(power * Math.random());
        for (let i = 0; i < length; i += 1) {
          const color =
            FIRE[
              Math.min(FIRE.length - 1, i + Math.floor(Math.random() * 2))
            ] ?? WHITE;
          plot(
            x - ux * (half + 1 + i),
            y - uy * (half + 1 + i),
            color,
            1 - i / (length + 1)
          );
        }
      };
      const p = game.player;
      if (!game.over) {
        let flame = 2;
        if (p.dashTime > 0) {
          flame = 6;
        } else if (p.throttle > 0) {
          flame = 4;
        } else if (p.throttle < 0) {
          flame = 0.5;
        }
        thruster(p.x, p.y, p.heading, flame);
      }
      for (const enemy of game.enemies) {
        // no flame while it hovers, like a charger winding up
        if (enemy.speed > 8) {
          thruster(
            enemy.x,
            enemy.y,
            enemy.heading,
            enemy.mode === "charge" ? 5 : 1.5
          );
        }
      }

      // aces carry a spinning gold ring so they stand out in a crowd
      for (const enemy of game.enemies) {
        if (!enemy.elite) {
          continue;
        }
        const spin = -this.time * 2;
        for (let i = 0; i < 20; i += 1) {
          if (i % 5 === 0) {
            continue;
          }
          const a = spin + (i / 20) * Math.PI * 2;
          plot(
            enemy.x + Math.cos(a) * 11,
            enemy.y + Math.sin(a) * 11,
            GOLD,
            0.85
          );
        }
      }

      // a chevron off the nose: the ship flies and fires this way
      if (!game.over) {
        const ux = Math.cos(p.heading);
        const uy = Math.sin(p.heading);
        plot(p.x + ux * 12, p.y + uy * 12, NOTRA_VIOLET, 1);
        plot(
          p.x + ux * 10 - uy * 2,
          p.y + uy * 10 + ux * 2,
          NOTRA_VIOLET,
          0.85
        );
        plot(
          p.x + ux * 10 + uy * 2,
          p.y + uy * 10 - ux * 2,
          NOTRA_VIOLET,
          0.85
        );
        if (p.shield) {
          const spin = this.time * 3;
          const steps = 24;
          for (let i = 0; i < steps; i += 1) {
            if (i % 4 === 0) {
              continue;
            }
            const a = spin + (i / steps) * Math.PI * 2;
            plot(
              p.x + Math.cos(a) * 10,
              p.y + Math.sin(a) * 10,
              PICKUP_COLORS.shield,
              0.8
            );
          }
        }
      }

      // floating score
      for (const floater of this.floaters) {
        const alpha = Math.min(1, floater.life / (floater.max * 0.4));
        text(
          floater.text,
          floater.x - textWidth(floater.text) / 2,
          floater.y,
          floater.color,
          1,
          alpha
        );
      }
    }

    if (this.flashScreen > 0 && !this.calm) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, (data[i] ?? 0) + this.flashScreen * 300);
        data[i + 1] = Math.min(
          255,
          (data[i + 1] ?? 0) + this.flashScreen * 120
        );
        data[i + 2] = Math.min(
          255,
          (data[i + 2] ?? 0) + this.flashScreen * 160
        );
      }
    }

    const sx = this.calm ? 0 : this.shakeOffset.x;
    const sy = this.calm ? 0 : this.shakeOffset.y;
    ctx.fillStyle = rgba(SPACE, 1);
    ctx.fillRect(0, 0, W, H);
    ctx.putImageData(this.frame, sx, sy);

    if (game) {
      this.drawSprites(game, sx, sy);
    }

    // the HUD and overlays go on a second pass so sprites never cover them
    data.fill(0);
    if (game && overlay.hud) {
      this.drawHud(game, text, rect, plot);
    }
    if (this.banner && overlay.hud) {
      const b = this.banner;
      const t = b.life / b.max;
      const alpha = Math.min(1, t * 4, (1 - t) * 8 + 0.2);
      const titleW = textWidth(b.title) * 2;
      text(b.title, (W - titleW) / 2, H / 2 - 18, b.color, 2, alpha);
      if (b.sub) {
        text(
          b.sub,
          (W - textWidth(b.sub)) / 2,
          H / 2 - 3,
          WHITE,
          1,
          alpha * 0.85
        );
      }
    }
    for (const stick of overlay.sticks) {
      circle(stick.x, stick.y, 14, WHITE, 0.25, true);
      const knobX = stick.x + stick.dx * 10;
      const knobY = stick.y + stick.dy * 10;
      for (let oy = -3; oy <= 3; oy += 1) {
        for (let ox = -3; ox <= 3; ox += 1) {
          if (ox * ox + oy * oy <= 9) {
            plot(knobX + ox, knobY + oy, NOTRA_VIOLET, 0.5);
          }
        }
      }
    }
    if (overlay.reticle && game && !game.over) {
      const { x, y } = overlay.reticle;
      for (let i = 2; i <= 4; i += 1) {
        plot(x + i, y, WHITE, 0.95);
        plot(x - i, y, WHITE, 0.95);
        plot(x, y + i, WHITE, 0.95);
        plot(x, y - i, WHITE, 0.95);
      }
      plot(x, y, NOTRA_VIOLET, 1);
    }
    const overlayCanvas = this.overlayCanvas();
    const octx = overlayCanvas.getContext("2d");
    if (octx) {
      octx.putImageData(this.frame, 0, 0);
      ctx.drawImage(overlayCanvas, 0, 0);
    }
  }

  private overlayBuffer: HTMLCanvasElement | null = null;

  private overlayCanvas() {
    if (!this.overlayBuffer) {
      this.overlayBuffer = document.createElement("canvas");
      this.overlayBuffer.width = ARENA_W;
      this.overlayBuffer.height = ARENA_H;
    }
    return this.overlayBuffer;
  }

  private drawSprites(game: Game, sx: number, sy: number) {
    const ctx = this.ctx;
    const sprites = this.sprites;
    if (!sprites) {
      return;
    }
    const half = Math.floor(SPRITE_SIZE / 2) + 1;

    const boss = game.boss;
    if (boss) {
      const bossHalf = Math.floor(BOSS_SIZE / 2) + 1;
      const turn = (((boss.angle / (Math.PI * 2)) % 1) + 1) % 1;
      const frame = Math.floor(turn * BOSS_FRAMES) % BOSS_FRAMES;
      const flashing =
        boss.flash > 0 || (boss.phase === "dying" && Math.random() < 0.3);
      const set = sprites[boss.model];
      const sprite = (flashing ? set.bossFlash : set.boss)[frame];
      if (sprite) {
        ctx.drawImage(
          sprite,
          Math.round(boss.x) - bossHalf + sx,
          Math.round(boss.y) - bossHalf + sy
        );
      }
    }

    for (const ghost of this.ghosts) {
      ctx.globalAlpha = ghost.life * 2.5;
      ctx.drawImage(
        sprites[ghost.model].ship,
        Math.round(ghost.x) - half + sx,
        Math.round(ghost.y) - half + sy
      );
    }
    ctx.globalAlpha = 1;

    for (const enemy of game.enemies) {
      const set = sprites[enemy.model];
      const windupBlink =
        enemy.mode === "windup" && Math.floor(enemy.modeTime * 20) % 2 === 0;
      const sprite = enemy.flash > 0 || windupBlink ? set.flash : set.ship;
      const x = Math.round(enemy.x) - half;
      const y = Math.round(enemy.y) - half;
      ctx.drawImage(sprite, x + sx, y + sy);
      if (enemy.hp < enemy.maxHp) {
        const w = 11;
        ctx.fillStyle = rgba(SPACE, 0.8);
        ctx.fillRect(x + 2 + sx, y + SPRITE_SIZE + 3 + sy, w, 2);
        ctx.fillStyle = rgba(MODEL_COLORS[enemy.model], 1);
        ctx.fillRect(
          x + 2 + sx,
          y + SPRITE_SIZE + 3 + sy,
          Math.max(1, Math.round((w * enemy.hp) / enemy.maxHp)),
          1
        );
      }
    }

    const p = game.player;
    const blinking = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
    if (!game.over && !blinking) {
      const set = sprites[game.spec.id];
      ctx.drawImage(
        set.ship,
        Math.round(p.x) - half + sx,
        Math.round(p.y) - half + sy
      );
      // the hitbox, a single bright pixel in the middle
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(p.x) + sx, Math.round(p.y) + sy, 1, 1);
    }
  }

  private drawHud(
    game: Game,
    text: (
      value: string,
      x: number,
      y: number,
      rgb: Rgb,
      scale?: number,
      alpha?: number
    ) => void,
    rect: (
      x: number,
      y: number,
      w: number,
      h: number,
      rgb: Rgb,
      alpha?: number
    ) => void,
    plot: (
      x: number,
      y: number,
      rgb: Rgb,
      alpha?: number,
      size?: number
    ) => void
  ) {
    const W = ARENA_W;
    const H = ARENA_H;
    const p = game.player;
    const color = game.spec.color;
    // the HUD fades while the ship flies underneath it, so it never hides you
    const under = (x0: number, y0: number, x1: number, y1: number) =>
      p.x > x0 - 8 && p.x < x1 + 8 && p.y > y0 - 8 && p.y < y1 + 8 ? 0.3 : 1;

    const topLeft = under(0, 0, 44, 16);
    text(String(game.score).padStart(7, "0"), 4, 4, WHITE, 1, topLeft);
    if (game.multiplier > 1) {
      const label = `x${game.multiplier}`;
      text(label, 4, 11, GOLD, 1, topLeft);
      const w = Math.round(20 * (game.comboTimer / COMBO_WINDOW_S));
      rect(
        4 + textWidth(label) + 3,
        13,
        Math.max(0, w),
        1,
        GOLD,
        0.8 * topLeft
      );
    }

    const waveLabel =
      game.wave.number > 0 ? `WAVE ${game.wave.number}` : "GET READY";
    text(
      waveLabel,
      W - 4 - textWidth(waveLabel),
      4,
      WHITE,
      1,
      0.9 * under(W - 44, 0, W, 10)
    );

    // health pips, shield, strikes and the dash meter, bottom left
    for (let i = 0; i < p.maxHp; i += 1) {
      const filled = i < p.hp;
      rect(4 + i * 6, H - 9, 5, 5, filled ? color : SPACE, filled ? 1 : 0.9);
      if (!filled) {
        rect(4 + i * 6, H - 9, 5, 1, color, 0.4);
        rect(4 + i * 6, H - 5, 5, 1, color, 0.4);
        rect(4 + i * 6, H - 9, 1, 5, color, 0.4);
        rect(8 + i * 6, H - 9, 1, 5, color, 0.4);
      }
    }
    let x = 4 + p.maxHp * 6 + 2;
    if (p.shield) {
      rect(x, H - 9, 5, 5, PICKUP_COLORS.shield, 0.9);
      x += 8;
    }
    for (let i = 0; i < MAX_BOMBS; i += 1) {
      const filled = i < p.bombs;
      const cx = x + 2 + i * 7;
      const cy = H - 7;
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (Math.abs(ox) + Math.abs(oy) <= 2) {
            plot(cx + ox, cy + oy, NOTRA_VIOLET, filled ? 1 : 0.18);
          }
        }
      }
    }
    const dashReady = 1 - p.dashCooldown / game.spec.dashCooldown;
    rect(4, H - 3, 28, 1, WHITE, 0.15);
    rect(
      4,
      H - 3,
      Math.round(28 * dashReady),
      1,
      dashReady >= 1 ? WHITE : SMOKE,
      0.9
    );

    if (p.overdrive > 0) {
      const label = "OVERDRIVE";
      text(label, W - 4 - textWidth(label), H - 11, GOLD, 1, 0.9);
      rect(
        W - 4 - 36,
        H - 4,
        Math.round(36 * (p.overdrive / OVERDRIVE_S)),
        1,
        GOLD,
        0.9
      );
    }

    // every upgrade taken this run, bottom centre, with its level when above one
    const taken = UPGRADES.filter((upgrade) => game.level(upgrade.id) > 0);
    if (taken.length > 0) {
      const slot = 11;
      let ux = Math.round((W - taken.length * slot) / 2);
      for (const upgrade of taken) {
        for (let gy = 0; gy < upgrade.icon.length; gy += 1) {
          const row = upgrade.icon[gy] ?? "";
          for (let gx = 0; gx < row.length; gx += 1) {
            if (row[gx] === "#") {
              plot(ux + gx, H - 10 + gy, upgrade.color, 0.9);
            }
          }
        }
        const level = game.level(upgrade.id);
        if (level > 1) {
          text(String(level), ux + 7, H - 6, WHITE, 1, 0.9);
        }
        ux += slot;
      }
    }

    const boss = game.boss;
    if (boss && boss.phase !== "dying") {
      const name = `GIANT ${modelSpec(boss.model).name.toUpperCase()}`;
      const barW = 140;
      const bx = (W - barW) / 2;
      text(name, (W - textWidth(name)) / 2, 12, MODEL_COLORS[boss.model], 1);
      rect(bx - 1, 19, barW + 2, 4, SPACE, 0.9);
      const left = Math.max(0, boss.hp / boss.maxHp);
      rect(
        bx,
        20,
        Math.max(1, Math.round(barW * left)),
        2,
        left < 1 / 3 ? DANGER : MODEL_COLORS[boss.model],
        1
      );
    }
  }
}

function waveHint(number: number, game: Game) {
  const newcomer = game.rivals.find(
    (id) => modelSpec(id).enemy.unlockWave === number
  );
  if (newcomer && number > 1) {
    return `NEW: ${modelSpec(newcomer).name.toUpperCase()}`;
  }
  if (number === 1) {
    return "SHOOT THE OTHER MODELS";
  }
  return number === 2 ? "TIP: RAM SMALL SHIPS, DODGE THEIR SHOTS" : "";
}
