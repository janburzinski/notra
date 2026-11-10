import {
  BATTLE_AIM_JITTER,
  BATTLE_AREA_PER_SHIP,
  BATTLE_AREA_PER_STAR,
  BATTLE_ATTACK_S,
  BATTLE_AVOID_PADDING,
  BATTLE_BOLT_LENGTH,
  BATTLE_BOLT_LIFE,
  BATTLE_BOLT_SPEED,
  BATTLE_BOOST_SPEED,
  BATTLE_BOSS_ATTACK_S,
  BATTLE_BOSS_DYING_S,
  BATTLE_BOSS_ENTER_S,
  BATTLE_BOSS_FACTION,
  BATTLE_BOSS_FIRE_RATE,
  BATTLE_BOSS_FIRST_S,
  BATTLE_BOSS_FOCUS,
  BATTLE_BOSS_FRAMES,
  BATTLE_BOSS_HP,
  BATTLE_BOSS_INTERVAL_S,
  BATTLE_BOSS_RADIUS,
  BATTLE_BOSS_RAGE_ATTACK_S,
  BATTLE_BOSS_RING_BOLTS,
  BATTLE_BOSS_SIZE,
  BATTLE_BOSS_SPIRAL_GAP_S,
  BATTLE_BOSS_SPIRAL_S,
  BATTLE_BOSS_TARGET,
  BATTLE_BREAK_DISTANCE,
  BATTLE_BREAK_S,
  BATTLE_BURST_COOLDOWN,
  BATTLE_BURST_GAP_S,
  BATTLE_BURST_SHOTS,
  BATTLE_CRUISE_SPEED,
  BATTLE_EDGE_MARGIN,
  BATTLE_EVADE_RADIUS,
  BATTLE_EVADE_S,
  BATTLE_FACTIONS,
  BATTLE_FIRE_CONE,
  BATTLE_FIRE_RANGE,
  BATTLE_GRIP,
  BATTLE_HEAVY_BOLT_LIFE,
  BATTLE_HEAVY_BOLT_SPEED,
  BATTLE_HIT_RADIUS,
  BATTLE_LOOKAHEAD_S,
  BATTLE_MIN_SPEED,
  BATTLE_MISSILE_ACCEL,
  BATTLE_MISSILE_COOLDOWN,
  BATTLE_MISSILE_DAMAGE,
  BATTLE_MISSILE_LIFE,
  BATTLE_MISSILE_SPEED,
  BATTLE_MIN_BAY,
  BATTLE_MISSILE_TURN,
  BATTLE_RESPAWN_S,
  BATTLE_SEPARATION,
  BATTLE_SHIP_HP,
  BATTLE_SHIPS_PER_FACTION,
  BATTLE_SPRITE_SIZE,
  BATTLE_STAR_DRIFT,
  BATTLE_STRIKE_BOSS_DAMAGE,
  BATTLE_STRIKE_DAMAGE,
  BATTLE_STRIKE_RADIUS,
  BATTLE_THROTTLE,
  BATTLE_TOP_MARGIN,
  BATTLE_TRAIL_LENGTH,
  BATTLE_TRAIL_STEP_S,
  BATTLE_TURN_RATE,
  BATTLE_WALL_TURN,
} from "@/constants/mcp-battle";
import type {
  BattleBay,
  BattleBolt,
  BattleBoss,
  BattleMissile,
  BattleParticle,
  BattleRect,
  BattleRing,
  BattleShip,
  BattleSprites,
  BattleStar,
  BattleTheme,
  BattleTone,
  Rgb,
} from "@/types/mcp-battle";

/** Anything a ship can chase: another ship or the boss. */
interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const WHITE: Rgb = [255, 255, 255];
const FIRE: Rgb[] = [
  [255, 247, 205],
  [253, 224, 71],
  [251, 146, 60],
  [234, 88, 12],
];

function between([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function side() {
  return Math.random() < 0.5 ? 1 : -1;
}

/** The signed difference between two angles, in (-π, π]. */
function angleDiff(to: number, from: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) {
    d -= Math.PI * 2;
  } else if (d <= -Math.PI) {
    d += Math.PI * 2;
  }
  return d;
}

function turnToward(current: number, desired: number, maxStep: number) {
  return current + clamp(angleDiff(desired, current), -maxStep, maxStep);
}

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

/**
 * A dogfight between the Claude, ChatGPT and Cursor logos. Ships fly where their nose points and turn at
 * a limited rate, so they swoop instead of drift: they line up strafing runs, fire bursts when the
 * target crosses their nose, launch the odd homing missile, peel off when they overshoot and jink out
 * of incoming fire. Every so often a giant Claude flies in as a boss; ChatGPT and Cursor team up on it
 * while the small Claudes fly escort. Visitors can click the sky to drop a Notra strike. Everything is
 * in art pixels; the canvas is that coarse and scaled up.
 */
export class BattleEngine {
  private width = 0;
  private height = 0;
  private avoid: BattleRect | null = null;
  private time = 0;
  private ships: BattleShip[] = [];
  private bolts: BattleBolt[] = [];
  private missiles: BattleMissile[] = [];
  private particles: BattleParticle[] = [];
  private rings: BattleRing[] = [];
  private stars: BattleStar[] = [];
  /** Reused pixel buffer for everything that isn't a sprite. */
  private frame: ImageData | null = null;
  private boss: BattleBoss | null = null;
  private bossTimer = BATTLE_BOSS_FIRST_S;
  /** Screen shake in art pixels; decays on its own. */
  shake = 0;

  /** The visitor clicked empty sky: a Notra shockwave that hurts every ship and the boss nearby. */
  strike(x: number, y: number) {
    // with no fleet (a phone-sized hero) a strike would just be a stray flash
    if (this.ships.length === 0) {
      return;
    }
    this.rings.push({ x, y, life: 0.25, max: 0.25, r: 8, tone: WHITE });
    this.rings.push({
      x,
      y,
      life: 0.55,
      max: 0.55,
      r: BATTLE_STRIKE_RADIUS + 4,
      tone: "notra",
    });
    this.burst(x, y, 22, 60, ["notra", WHITE, "notra"], 0.5);
    this.shake = Math.max(this.shake, 0.8);
    for (const ship of this.ships) {
      if (
        ship.respawn <= 0 &&
        Math.hypot(ship.x - x, ship.y - y) < BATTLE_STRIKE_RADIUS
      ) {
        this.damage(
          ship,
          BATTLE_STRIKE_DAMAGE,
          (ship.x - x) * 25,
          (ship.y - y) * 25,
          -1
        );
      }
    }
    const boss = this.boss;
    if (
      boss &&
      boss.phase !== "dying" &&
      Math.hypot(boss.x - x, boss.y - y) <
        BATTLE_BOSS_RADIUS + BATTLE_STRIKE_RADIUS
    ) {
      this.hitBoss(BATTLE_STRIKE_BOSS_DAMAGE, x, y);
    }
  }

  resize(width: number, height: number, avoid: BattleRect | null) {
    const changed = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    this.avoid = avoid;
    if (width === 0 || height === 0) {
      return;
    }
    if (changed) {
      this.seedStars();
    }
    this.fitShips();
  }

  private seedStars() {
    const { width, height } = this;
    const starCount = Math.round((width * height) / BATTLE_AREA_PER_STAR);
    this.stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      depth: Math.random() ** 2,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  /** The widest open strip beside the headline block, in art pixels. */
  private widestBay() {
    const rect = this.avoid;
    if (!rect) {
      return this.width;
    }
    return Math.max(rect.x, this.width - rect.x - rect.w);
  }

  /** Matches the fleet to the room there is. Phones get none: the headline fills their hero. */
  private fitShips() {
    const { width, height } = this;
    const perFaction =
      this.widestBay() < BATTLE_MIN_BAY
        ? 0
        : Math.round(
            clamp(
              (width * height) / BATTLE_AREA_PER_SHIP / BATTLE_FACTIONS.length,
              ...BATTLE_SHIPS_PER_FACTION
            )
          );
    const wanted = perFaction * BATTLE_FACTIONS.length;
    this.ships = this.ships.slice(0, wanted);
    for (const ship of this.ships) {
      this.confine(ship);
    }
    while (this.ships.length < wanted) {
      this.ships.push(this.spawn(this.ships.length % BATTLE_FACTIONS.length));
    }
  }

  simulate(dt: number) {
    if (this.width === 0) {
      return;
    }
    this.time += dt;
    for (const star of this.stars) {
      star.x -= BATTLE_STAR_DRIFT * (0.3 + star.depth) * dt;
      if (star.x < 0) {
        star.x += this.width;
        star.y = Math.random() * this.height;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 6);
    this.updateBoss(dt);
    for (const ship of this.ships) {
      this.fly(ship, dt);
    }
    this.moveBolts(dt);
    this.moveMissiles(dt);
    const drag = 1 - 2.2 * dt;
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
  }

  render(
    ctx: CanvasRenderingContext2D,
    theme: BattleTheme,
    sprites: BattleSprites
  ) {
    const { width, height } = this;
    if (width === 0 || height === 0) {
      return;
    }
    // every loose pixel goes into one buffer that is uploaded once; only sprites are drawn as images
    if (this.frame?.width !== width || this.frame.height !== height) {
      this.frame = ctx.createImageData(width, height);
    }
    const frame = this.frame;
    const data = frame.data;
    data.fill(0);
    const plot = (x: number, y: number, rgb: Rgb, alpha: number, size = 1) => {
      const a = clamp(alpha, 0, 1);
      if (a <= 0) {
        return;
      }
      const px = Math.round(x);
      const py = Math.round(y);
      for (let oy = 0; oy < size; oy += 1) {
        for (let ox = 0; ox < size; ox += 1) {
          const tx = px + ox;
          const ty = py + oy;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) {
            continue;
          }
          const i = (ty * width + tx) * 4;
          const below = ((data[i + 3] ?? 0) / 255) * (1 - a);
          const out = a + below;
          data[i] = (rgb[0] * a + (data[i] ?? 0) * below) / out;
          data[i + 1] = (rgb[1] * a + (data[i + 1] ?? 0) * below) / out;
          data[i + 2] = (rgb[2] * a + (data[i + 2] ?? 0) * below) / out;
          data[i + 3] = out * 255;
        }
      }
    };
    const tone = (value: BattleTone): Rgb => {
      if (value === "smoke") {
        return theme.smoke;
      }
      if (value === "notra") {
        return theme.notra;
      }
      return typeof value === "number" ? this.factionRgb(value, theme) : value;
    };

    for (const star of this.stars) {
      const twinkle = 0.75 + 0.25 * Math.sin(star.phase + this.time * 1.7);
      plot(star.x, star.y, theme.star, (0.18 + 0.55 * star.depth) * twinkle);
    }

    // engine trails under everything else
    for (const ship of this.ships) {
      if (ship.respawn > 0 || ship.trail.length < 2) {
        continue;
      }
      const rgb = this.factionRgb(ship.faction, theme);
      const n = ship.trail.length;
      for (let i = 1; i < n; i += 1) {
        const from = ship.trail[i - 1];
        const to = ship.trail[i];
        if (from && to) {
          this.line(from, to, (x, y) => plot(x, y, rgb, (i / n) * 0.55));
        }
      }
    }

    for (const ring of this.rings) {
      const t = 1 - ring.life / ring.max;
      const radius = ring.r * (0.25 + 0.75 * Math.sqrt(t));
      const steps = Math.max(10, Math.round(radius * 6));
      const rgb = tone(ring.tone);
      for (let i = 0; i < steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        plot(
          ring.x + Math.cos(a) * radius,
          ring.y + Math.sin(a) * radius,
          rgb,
          (1 - t) * 0.9
        );
      }
    }

    for (const p of this.particles) {
      plot(p.x, p.y, tone(p.tone), p.life / p.max, p.size);
    }

    for (const bolt of this.bolts) {
      const rgb = this.factionRgb(bolt.faction, theme);
      const speed = Math.hypot(bolt.vx, bolt.vy) || 1;
      const ux = bolt.vx / speed;
      const uy = bolt.vy / speed;
      if (bolt.heavy) {
        // a fat glowing pellet with a short tail
        plot(bolt.x - ux * 2, bolt.y - uy * 2, rgb, 0.5, 2);
        plot(bolt.x - 1, bolt.y - 1, rgb, 1, 3);
        plot(bolt.x, bolt.y, mix(rgb, WHITE, 0.75), 1);
        continue;
      }
      const head = mix(rgb, WHITE, theme.dark ? 0.7 : 0.45);
      for (let i = BATTLE_BOLT_LENGTH - 1; i >= 0; i -= 1) {
        plot(
          bolt.x - ux * i,
          bolt.y - uy * i,
          i < 2 ? head : rgb,
          i < 2 ? 1 : 1 - i / (BATTLE_BOLT_LENGTH + 1)
        );
      }
    }

    for (const missile of this.missiles) {
      const ux = Math.cos(missile.heading);
      const uy = Math.sin(missile.heading);
      plot(
        missile.x - ux,
        missile.y - uy,
        this.factionRgb(missile.faction, theme),
        1
      );
      plot(missile.x, missile.y, WHITE, 1);
      plot(
        missile.x - ux * 2,
        missile.y - uy * 2,
        FIRE[1 + Math.floor(Math.random() * 2)] ?? WHITE,
        1
      );
    }

    // a flickering thruster behind each logo, longer while boosting
    const half = Math.floor(BATTLE_SPRITE_SIZE / 2);
    for (const ship of this.ships) {
      if (ship.respawn > 0) {
        continue;
      }
      const ux = Math.cos(ship.heading);
      const uy = Math.sin(ship.heading);
      const boost = (ship.speed - BATTLE_MIN_SPEED) / 16;
      const flameLength = 2 + Math.round(boost * Math.random());
      for (let i = 0; i < flameLength; i += 1) {
        const color =
          FIRE[Math.min(FIRE.length - 1, i + Math.floor(Math.random() * 2))] ??
          WHITE;
        plot(
          ship.x - ux * (half + 1 + i),
          ship.y - uy * (half + 1 + i),
          color,
          1 - i / (flameLength + 1)
        );
      }
    }

    ctx.putImageData(frame, 0, 0);
    this.renderBoss(ctx, theme, sprites);
    for (const ship of this.ships) {
      if (ship.respawn > 0) {
        continue;
      }
      const sprite =
        ship.flash > 0
          ? sprites.flash[ship.faction]
          : sprites.tinted[ship.faction];
      const x = Math.round(ship.x) - half;
      const y = Math.round(ship.y) - half;
      if (sprite) {
        ctx.drawImage(sprite, x, y);
      } else {
        ctx.fillStyle = rgba(this.factionRgb(ship.faction, theme), 1);
        ctx.fillRect(x + half - 2, y + half - 2, 5, 5);
      }
    }
  }

  private renderBoss(
    ctx: CanvasRenderingContext2D,
    theme: BattleTheme,
    sprites: BattleSprites
  ) {
    const boss = this.boss;
    if (!boss) {
      return;
    }
    const half = Math.floor(BATTLE_BOSS_SIZE / 2);
    const turn = (((boss.angle / (Math.PI * 2)) % 1) + 1) % 1;
    const frame = Math.floor(turn * BATTLE_BOSS_FRAMES) % BATTLE_BOSS_FRAMES;
    const flashing =
      boss.flash > 0 || (boss.phase === "dying" && Math.random() < 0.25);
    const sprite = (flashing ? sprites.bossFlash : sprites.boss)[frame];
    const x = Math.round(boss.x) - half;
    const y = Math.round(boss.y) - half;
    const rgb = this.factionRgb(BATTLE_BOSS_FACTION, theme);
    if (sprite) {
      ctx.drawImage(sprite, x, y);
    } else {
      ctx.fillStyle = rgba(rgb, 1);
      ctx.fillRect(x + 6, y + 6, BATTLE_BOSS_SIZE - 12, BATTLE_BOSS_SIZE - 12);
    }
    if (boss.phase === "dying") {
      return;
    }
    // health bar above the boss
    const barWidth = 25;
    const barX = Math.round(boss.x) - Math.floor(barWidth / 2);
    const barY = y - 4;
    const left = Math.max(0, boss.hp / BATTLE_BOSS_HP);
    ctx.fillStyle = rgba(theme.dark ? [20, 14, 36] : [255, 255, 255], 0.7);
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, 4);
    ctx.fillStyle = rgba(left < 0.34 ? [239, 68, 68] : rgb, 1);
    ctx.fillRect(barX, barY, Math.max(1, Math.round(barWidth * left)), 2);
  }

  /** Calls `plot` for every pixel on the straight line between two points, end excluded. */
  private line(
    from: { x: number; y: number },
    to: { x: number; y: number },
    plot: (x: number, y: number) => void
  ) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      plot(from.x + dx * t, from.y + dy * t);
    }
  }

  private factionRgb(faction: number, theme: BattleTheme): Rgb {
    const entry = BATTLE_FACTIONS[faction] ?? BATTLE_FACTIONS[0];
    if (!entry) {
      return WHITE;
    }
    return theme.dark ? entry.dark : entry.light;
  }

  private inAvoid(x: number, y: number, padding: number) {
    const rect = this.avoid;
    return (
      rect !== null &&
      x > rect.x - padding &&
      x < rect.x + rect.w + padding &&
      y > rect.y - padding &&
      y < rect.y + rect.h + padding
    );
  }

  /** A free spot away from the headline and the other ships, just off the side when `fromEdge`. */
  private freeSpot(fromEdge: boolean) {
    let best = { x: this.width / 2, y: BATTLE_TOP_MARGIN };
    let bestScore = -1;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = fromEdge
        ? side() * (this.width / 2 + 8) + this.width / 2
        : BATTLE_EDGE_MARGIN +
          Math.random() * (this.width - 2 * BATTLE_EDGE_MARGIN);
      const y =
        BATTLE_TOP_MARGIN +
        Math.random() * (this.height - BATTLE_TOP_MARGIN - BATTLE_EDGE_MARGIN);
      if (this.inAvoid(x, y, BATTLE_AVOID_PADDING * 2)) {
        continue;
      }
      let nearest = Number.POSITIVE_INFINITY;
      for (const ship of this.ships) {
        if (ship.respawn <= 0) {
          nearest = Math.min(nearest, Math.hypot(ship.x - x, ship.y - y));
        }
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y };
      }
    }
    return best;
  }

  private spawn(faction: number, fromEdge = false): BattleShip {
    const { x, y } = this.freeSpot(fromEdge);
    const heading =
      Math.atan2(this.height / 2 - y, this.width / 2 - x) +
      (Math.random() - 0.5) * 0.8;
    const speed = fromEdge ? BATTLE_BOOST_SPEED : BATTLE_CRUISE_SPEED;
    return {
      faction,
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      heading,
      speed,
      hp: BATTLE_SHIP_HP,
      target: -1,
      mode: "attack",
      modeTime: between(BATTLE_ATTACK_S),
      modeAngle: heading,
      burst: 0,
      burstTimer: 0,
      burstCooldown: between(BATTLE_BURST_COOLDOWN),
      missileCooldown: between(BATTLE_MISSILE_COOLDOWN),
      respawn: 0,
      flash: 0,
      trail: [],
      trailClock: 0,
    };
  }

  private pickTarget(ship: BattleShip) {
    const boss = this.boss;
    if (boss?.phase === "fight" && ship.faction !== BATTLE_BOSS_FACTION) {
      // shots across the headline get swallowed, so ships on the far side mostly stick to dogfights
      const middle = this.avoid
        ? this.avoid.x + this.avoid.w / 2
        : this.width / 2;
      const sameSide = Math.sign(ship.x - middle) === boss.side;
      if (Math.random() < (sameSide ? BATTLE_BOSS_FOCUS : 0.3)) {
        return BATTLE_BOSS_TARGET;
      }
    }
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    this.ships.forEach((other, index) => {
      if (other.faction === ship.faction || other.respawn > 0) {
        return;
      }
      // prefer what's in front of the nose, with some noise so ships spread their attention
      const bearing = Math.atan2(other.y - ship.y, other.x - ship.x);
      const offNose = Math.abs(angleDiff(bearing, ship.heading));
      const score =
        Math.hypot(other.x - ship.x, other.y - ship.y) *
        (1 + offNose * 0.6) *
        (this.hunted(index, ship) ? 1.8 : 1) *
        (0.75 + Math.random() * 0.5);
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    });
    return best;
  }

  /** What a ship or missile with this target is chasing, if it's still there. */
  private body(target: number): Body | undefined {
    if (target === BATTLE_BOSS_TARGET) {
      return this.boss && this.boss.phase !== "dying" ? this.boss : undefined;
    }
    const ship = this.ships[target];
    return ship && ship.respawn <= 0 ? ship : undefined;
  }

  /**
   * Hard limits for when steering can't turn in time (a knock from a hit, a dodge, a tight squeeze): a
   * ship slides along the headline block, under the nav and along the sides instead of crossing them.
   * Ships still flying in from off screen are let through the side walls.
   */
  private confine(ship: BattleShip) {
    const half = BATTLE_SPRITE_SIZE / 2;
    const ceiling = BATTLE_TOP_MARGIN;
    const floor = this.height - half;
    // drop the speed into the wall and swing the nose along it over a few frames, so the thruster
    // and trail bend round instead of snapping
    const slide = (axis: "x" | "y") => {
      if (axis === "x") {
        ship.vx = 0;
        const down = ship.vy === 0 ? Math.sin(ship.heading) >= 0 : ship.vy > 0;
        ship.heading = turnToward(
          ship.heading,
          down ? Math.PI / 2 : -Math.PI / 2,
          BATTLE_WALL_TURN
        );
      } else {
        ship.vy = 0;
        const right = ship.vx === 0 ? Math.cos(ship.heading) >= 0 : ship.vx > 0;
        ship.heading = turnToward(
          ship.heading,
          right ? 0 : Math.PI,
          BATTLE_WALL_TURN
        );
      }
    };

    const rect = this.avoid;
    if (rect) {
      const pad = half + 1;
      const left = rect.x - pad;
      const right = rect.x + rect.w + pad;
      const top = rect.y - pad;
      const bottom = rect.y + rect.h + pad;
      if (ship.x > left && ship.x < right && ship.y > top && ship.y < bottom) {
        // leave by the nearest side that isn't walled off by the nav or the floor
        const exits = [
          { d: ship.x - left, axis: "x" as const, to: left, ok: left > 0 },
          {
            d: right - ship.x,
            axis: "x" as const,
            to: right,
            ok: right < this.width,
          },
          { d: ship.y - top, axis: "y" as const, to: top, ok: top >= ceiling },
          {
            d: bottom - ship.y,
            axis: "y" as const,
            to: bottom,
            ok: bottom <= floor,
          },
        ]
          .filter((exit) => exit.ok)
          .sort((a, b) => a.d - b.d);
        const exit = exits[0];
        if (exit) {
          ship[exit.axis] = exit.to;
          slide(exit.axis);
        }
      }
    }

    if (ship.y < ceiling) {
      ship.y = ceiling;
      slide("y");
    } else if (ship.y > floor) {
      ship.y = floor;
      slide("y");
    }
    if (ship.x < half && ship.vx < 0) {
      ship.x = Math.max(ship.x, half);
      slide("x");
    } else if (ship.x > this.width - half && ship.vx > 0) {
      ship.x = Math.min(ship.x, this.width - half);
      slide("x");
    }
  }

  /** Whether a wingman of `ship` is already after this target, so pairs split up instead of stacking. */
  private hunted(index: number, ship: BattleShip) {
    return this.ships.some(
      (other) =>
        other !== ship &&
        other.faction === ship.faction &&
        other.respawn <= 0 &&
        other.target === index
    );
  }

  /** Pushes away from walls and the headline, judged from where the ship will be shortly. */
  private hazards(ship: BattleShip) {
    const ax = ship.x + ship.vx * BATTLE_LOOKAHEAD_S;
    const ay = ship.y + ship.vy * BATTLE_LOOKAHEAD_S;
    let px = 0;
    let py = 0;
    if (ax < BATTLE_EDGE_MARGIN) {
      px += 1;
    } else if (ax > this.width - BATTLE_EDGE_MARGIN) {
      px -= 1;
    }
    if (ay < BATTLE_TOP_MARGIN + 6) {
      // the nav sits up there, so the ceiling pushes harder than the other walls
      py += 2;
    } else if (ay > this.height - BATTLE_EDGE_MARGIN) {
      py -= 1;
    }
    const rect = this.avoid;
    const ahead = this.inAvoid(ax, ay, BATTLE_AVOID_PADDING);
    // already over the block counts double, so a ship that slid in gets out fast
    const over = this.inAvoid(ship.x, ship.y, BATTLE_AVOID_PADDING);
    if (rect && (ahead || over)) {
      // slide round the block on the side the ship is already on
      const dx =
        (ship.x - (rect.x + rect.w / 2)) / (rect.w / 2 + BATTLE_AVOID_PADDING);
      const dy =
        (ship.y - (rect.y + rect.h / 2)) / (rect.h / 2 + BATTLE_AVOID_PADDING);
      const strength = over ? 2.8 : 1.4;
      if (Math.abs(dx) > Math.abs(dy)) {
        px += Math.sign(dx) * strength;
      } else {
        py += Math.sign(dy) * strength;
      }
    }
    return { x: px, y: py };
  }

  /** The direction of the nearest enemy shot about to reach this ship, if any. */
  private incoming(ship: BattleShip) {
    for (const bolt of this.bolts) {
      // the boss's slow spray is everywhere; dodging all of it would leave no time to shoot back
      if (
        !bolt.heavy &&
        this.closingIn(ship, bolt.faction, bolt.x, bolt.y, bolt.vx, bolt.vy)
      ) {
        return Math.atan2(bolt.vy, bolt.vx);
      }
    }
    for (const missile of this.missiles) {
      const vx = Math.cos(missile.heading);
      const vy = Math.sin(missile.heading);
      if (this.closingIn(ship, missile.faction, missile.x, missile.y, vx, vy)) {
        return missile.heading;
      }
    }
    return null;
  }

  private closingIn(
    ship: BattleShip,
    faction: number,
    x: number,
    y: number,
    vx: number,
    vy: number
  ) {
    const dx = ship.x - x;
    const dy = ship.y - y;
    return (
      faction !== ship.faction &&
      Math.abs(dx) < BATTLE_EVADE_RADIUS &&
      Math.abs(dy) < BATTLE_EVADE_RADIUS &&
      dx * vx + dy * vy > 0
    );
  }

  private setMode(
    ship: BattleShip,
    mode: BattleShip["mode"],
    time: number,
    angle = ship.heading
  ) {
    ship.mode = mode;
    ship.modeTime = time;
    ship.modeAngle = angle;
  }

  private fly(ship: BattleShip, dt: number) {
    ship.flash = Math.max(0, ship.flash - dt);
    if (ship.respawn > 0) {
      ship.respawn -= dt;
      if (ship.respawn <= 0) {
        Object.assign(ship, this.spawn(ship.faction, true));
      }
      return;
    }

    if (!this.body(ship.target)) {
      ship.target = this.pickTarget(ship);
    }
    const target = this.body(ship.target);
    const onBoss = ship.target === BATTLE_BOSS_TARGET;
    const dist = target
      ? Math.hypot(target.x - ship.x, target.y - ship.y)
      : Number.POSITIVE_INFINITY;

    ship.modeTime -= dt;
    if (ship.mode !== "evade" && Math.random() < dt * 6) {
      const threat = this.incoming(ship);
      if (threat !== null) {
        this.setMode(
          ship,
          "evade",
          BATTLE_EVADE_S,
          threat + side() * Math.PI * 0.5
        );
      }
    }
    if (
      ship.mode === "attack" &&
      (dist < BATTLE_BREAK_DISTANCE + (onBoss ? BATTLE_BOSS_RADIUS : 0) ||
        ship.modeTime <= 0)
    ) {
      this.setMode(
        ship,
        "break",
        between(BATTLE_BREAK_S),
        ship.heading + side() * between([0.9, 1.8])
      );
    } else if (ship.mode !== "attack" && ship.modeTime <= 0) {
      this.setMode(ship, "attack", between(BATTLE_ATTACK_S));
      ship.target = this.pickTarget(ship);
    }

    let desired = ship.modeAngle;
    let wantSpeed = BATTLE_BOOST_SPEED;
    let leadBearing = ship.heading + Math.PI;
    if (ship.mode === "attack") {
      wantSpeed = BATTLE_CRUISE_SPEED;
      if (target) {
        const lead = dist / (BATTLE_BOLT_SPEED + ship.speed);
        leadBearing = Math.atan2(
          target.y + target.vy * lead - ship.y,
          target.x + target.vx * lead - ship.x
        );
        desired = leadBearing;
        // ease off when closing in so the run lasts
        if (dist < 50) {
          wantSpeed = BATTLE_MIN_SPEED;
        }
      }
    }

    // walls, the headline and other ships bend the course
    const hazard = this.hazards(ship);
    let sx = Math.cos(desired) + hazard.x * 2.5;
    let sy = Math.sin(desired) + hazard.y * 2.5;
    for (const other of this.ships) {
      if (other === ship || other.respawn > 0) {
        continue;
      }
      const dx = ship.x - other.x;
      const dy = ship.y - other.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < BATTLE_SEPARATION) {
        const push = ((BATTLE_SEPARATION - d) / BATTLE_SEPARATION) * 2.5;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }
    const boss = this.boss;
    if (boss) {
      // nobody flies through the boss
      const dx = ship.x - boss.x;
      const dy = ship.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      const clearance = BATTLE_BOSS_RADIUS + 14;
      if (d < clearance) {
        sx += (dx / d) * ((clearance - d) / clearance) * 4;
        sy += (dy / d) * ((clearance - d) / clearance) * 4;
      }
    }
    if (hazard.x !== 0 || hazard.y !== 0) {
      wantSpeed = Math.min(wantSpeed, BATTLE_CRUISE_SPEED);
    }
    desired = Math.atan2(sy, sx);

    // tighter turns at lower speed, like a real craft
    const fast =
      (ship.speed - BATTLE_MIN_SPEED) / (BATTLE_BOOST_SPEED - BATTLE_MIN_SPEED);
    const turnRate = BATTLE_TURN_RATE * (1.25 - fast * 0.45);
    ship.heading = turnToward(ship.heading, desired, turnRate * dt);
    ship.speed += clamp(
      wantSpeed - ship.speed,
      -BATTLE_THROTTLE * dt,
      BATTLE_THROTTLE * dt
    );
    const grip = Math.min(1, BATTLE_GRIP * dt);
    ship.vx += (Math.cos(ship.heading) * ship.speed - ship.vx) * grip;
    ship.vy += (Math.sin(ship.heading) * ship.speed - ship.vy) * grip;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    this.confine(ship);

    ship.trailClock -= dt;
    if (ship.trailClock <= 0) {
      ship.trailClock = BATTLE_TRAIL_STEP_S;
      const back = BATTLE_SPRITE_SIZE / 2;
      ship.trail.push({
        x: ship.x - Math.cos(ship.heading) * back,
        y: ship.y - Math.sin(ship.heading) * back,
      });
      if (ship.trail.length > BATTLE_TRAIL_LENGTH) {
        ship.trail.shift();
      }
    }

    this.shoot(ship, target, dist, leadBearing, dt);
  }

  private shoot(
    ship: BattleShip,
    target: Body | undefined,
    dist: number,
    leadBearing: number,
    dt: number
  ) {
    ship.burstCooldown -= dt;
    ship.missileCooldown -= dt;
    if (ship.burst > 0) {
      ship.burstTimer -= dt;
      if (ship.burstTimer <= 0) {
        this.fireBolt(ship);
        ship.burst -= 1;
        ship.burstTimer = BATTLE_BURST_GAP_S;
      }
      return;
    }
    if (ship.mode !== "attack" || !target) {
      return;
    }
    // the boss is a big target, so ships open fire on it sooner and keep hammering
    const onBoss = ship.target === BATTLE_BOSS_TARGET;
    const cone = onBoss ? BATTLE_FIRE_CONE * 2 : BATTLE_FIRE_CONE;
    const onNose = Math.abs(angleDiff(leadBearing, ship.heading)) < cone;
    if (onNose && dist < BATTLE_FIRE_RANGE && ship.burstCooldown <= 0) {
      ship.burst = BATTLE_BURST_SHOTS;
      ship.burstTimer = 0;
      ship.burstCooldown =
        between(BATTLE_BURST_COOLDOWN) * (onBoss ? BATTLE_BOSS_FIRE_RATE : 1);
    }
    if (
      ship.missileCooldown <= 0 &&
      dist > 40 &&
      dist < BATTLE_FIRE_RANGE * 1.3
    ) {
      ship.missileCooldown = between(BATTLE_MISSILE_COOLDOWN);
      this.missiles.push({
        faction: ship.faction,
        target: ship.target,
        x: ship.x,
        y: ship.y,
        heading: ship.heading + side() * 0.7,
        speed: BATTLE_MISSILE_SPEED[0],
        life: BATTLE_MISSILE_LIFE,
      });
    }
  }

  private fireBolt(ship: BattleShip) {
    const angle = ship.heading + (Math.random() - 0.5) * 2 * BATTLE_AIM_JITTER;
    const muzzle = BATTLE_SPRITE_SIZE / 2 + 1;
    const x = ship.x + Math.cos(angle) * muzzle;
    const y = ship.y + Math.sin(angle) * muzzle;
    const speed = BATTLE_BOLT_SPEED + ship.speed;
    this.bolts.push({
      faction: ship.faction,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: BATTLE_BOLT_LIFE,
      heavy: false,
    });
    this.burst(x, y, 2, 12, [WHITE, ship.faction], 0.12);
  }

  private moveBolts(dt: number) {
    this.bolts = this.bolts.filter((bolt) => {
      bolt.life -= dt;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (
        bolt.life <= 0 ||
        this.offStage(bolt.x, bolt.y) ||
        this.inAvoid(bolt.x, bolt.y, 0)
      ) {
        return false;
      }
      if (this.bossAt(bolt.x, bolt.y, bolt.faction)) {
        this.hitBoss(1, bolt.x, bolt.y);
        return false;
      }
      const hit = this.shipAt(bolt.x, bolt.y, bolt.faction);
      if (hit) {
        this.damage(hit, 1, bolt.vx, bolt.vy, bolt.faction);
        this.burst(
          bolt.x,
          bolt.y,
          7,
          40,
          [WHITE, ...FIRE.slice(0, 2), bolt.faction],
          0.35
        );
        return false;
      }
      return true;
    });
  }

  private moveMissiles(dt: number) {
    this.missiles = this.missiles.filter((missile) => {
      missile.life -= dt;
      const target = this.body(missile.target);
      if (target) {
        const bearing = Math.atan2(target.y - missile.y, target.x - missile.x);
        missile.heading = turnToward(
          missile.heading,
          bearing,
          BATTLE_MISSILE_TURN * dt
        );
      }
      missile.speed = Math.min(
        BATTLE_MISSILE_SPEED[1],
        missile.speed + BATTLE_MISSILE_ACCEL * dt
      );
      const vx = Math.cos(missile.heading) * missile.speed;
      const vy = Math.sin(missile.heading) * missile.speed;
      missile.x += vx * dt;
      missile.y += vy * dt;
      if (Math.random() < dt * 40) {
        this.particles.push({
          size: 1,
          x: missile.x - Math.cos(missile.heading) * 3,
          y: missile.y - Math.sin(missile.heading) * 3,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 0.7,
          max: 0.7,
          tone: "smoke",
        });
      }
      if (this.bossAt(missile.x, missile.y, missile.faction)) {
        this.hitBoss(BATTLE_MISSILE_DAMAGE * 2, missile.x, missile.y);
        this.blast(missile.x, missile.y, missile.faction, 0.6);
        return false;
      }
      const hit = this.shipAt(missile.x, missile.y, missile.faction);
      if (hit) {
        this.damage(hit, BATTLE_MISSILE_DAMAGE, vx, vy, missile.faction);
        this.blast(missile.x, missile.y, missile.faction, 0.6);
        return false;
      }
      if (missile.life <= 0 || this.inAvoid(missile.x, missile.y, 0)) {
        this.blast(missile.x, missile.y, missile.faction, 0.35);
        return false;
      }
      return !this.offStage(missile.x, missile.y);
    });
  }

  private offStage(x: number, y: number) {
    return x < -12 || y < -12 || x > this.width + 12 || y > this.height + 12;
  }

  private shipAt(x: number, y: number, faction: number) {
    return this.ships.find(
      (ship) =>
        ship.faction !== faction &&
        ship.respawn <= 0 &&
        Math.abs(ship.x - x) < BATTLE_HIT_RADIUS &&
        Math.abs(ship.y - y) < BATTLE_HIT_RADIUS
    );
  }

  private burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    tones: BattleTone[],
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

  /** A fireball: hot sparks, a shockwave ring and smoke left hanging. */
  private blast(x: number, y: number, faction: number, scale: number) {
    this.burst(x, y, Math.round(30 * scale), 70 * scale, FIRE, 0.7);
    this.burst(x, y, Math.round(10 * scale), 20 * scale, ["smoke"], 1.4);
    this.rings.push({
      x,
      y,
      life: 0.35,
      max: 0.35,
      r: 10 * scale,
      tone: WHITE,
    });
    this.rings.push({
      x,
      y,
      life: 0.7,
      max: 0.7,
      r: 22 * scale,
      tone: faction,
    });
  }

  private damage(
    ship: BattleShip,
    amount: number,
    vx: number,
    vy: number,
    attacker: number
  ) {
    ship.hp -= amount;
    ship.flash = 0.1;
    ship.vx += vx * 0.08;
    ship.vy += vy * 0.08;
    if (ship.hp > 0) {
      // a hit ship tries to shake off whoever shot it
      if (ship.mode === "attack" && Math.random() < 0.5) {
        this.setMode(
          ship,
          "break",
          between(BATTLE_BREAK_S),
          Math.atan2(vy, vx) + side() * 1.2
        );
      }
      return;
    }
    this.blast(ship.x, ship.y, ship.faction, 1.2);
    this.shake = Math.max(this.shake, 0.6);
    // wreckage in the ship's colour keeps some of its momentum
    for (let i = 0; i < 7; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 18 + Math.random() * 30;
      const life = 0.8 + Math.random() * 0.6;
      this.particles.push({
        size: 2,
        x: ship.x,
        y: ship.y,
        vx: ship.vx * 0.5 + Math.cos(a) * v,
        vy: ship.vy * 0.5 + Math.sin(a) * v,
        life,
        max: life,
        tone: ship.faction,
      });
    }
    ship.respawn = between(BATTLE_RESPAWN_S);
    ship.trail = [];
    ship.burst = 0;
    for (const other of this.ships) {
      if (this.ships[other.target] !== ship) {
        continue;
      }
      other.target = -1;
      if (other.faction === attacker && other.mode === "attack") {
        // the winner pulls away before picking a new fight
        this.setMode(
          other,
          "break",
          between(BATTLE_BREAK_S),
          other.heading + side() * 1.4
        );
      }
    }
  }

  /** The open space beside the headline on one side, if it's wide enough for the boss. */
  private bossBay(side: 1 | -1): BattleBay | null {
    const rect = this.avoid;
    const pad = BATTLE_AVOID_PADDING;
    // without a headline block, the outer thirds of the hero are the bays
    const innerLeft = rect ? rect.x - pad : this.width * 0.3;
    const innerRight = rect ? rect.x + rect.w + pad : this.width * 0.7;
    const left = side < 0 ? BATTLE_EDGE_MARGIN : innerRight;
    const right = side < 0 ? innerLeft : this.width - BATTLE_EDGE_MARGIN;
    // the boss is tall, so it keeps a wider berth from the nav than the small ships
    const top = BATTLE_TOP_MARGIN + 12;
    const bottom = this.height - BATTLE_EDGE_MARGIN;
    const room = BATTLE_BOSS_SIZE + 8;
    if (right - left < room || bottom - top < room) {
      return null;
    }
    return {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      rx: (right - left - room) / 2,
      ry: (bottom - top - room) / 2,
    };
  }

  private spawnBoss() {
    const preferred = side();
    const bossSide = this.bossBay(preferred)
      ? preferred
      : (-preferred as 1 | -1);
    const bay = this.bossBay(bossSide);
    if (!bay) {
      // no bay wide enough on this layout: try again later in case it grows
      this.bossTimer = 10;
      return;
    }
    const startX =
      bossSide < 0 ? -BATTLE_BOSS_SIZE : this.width + BATTLE_BOSS_SIZE;
    this.boss = {
      x: startX,
      y: bay.y,
      vx: 0,
      vy: 0,
      startX,
      side: bossSide,
      hp: BATTLE_BOSS_HP,
      phase: "enter",
      phaseTime: 0,
      clock: 0,
      angle: 0,
      attack: 0,
      attackTimer: 1,
      spiralTime: 0,
      spiralClock: 0,
      blastClock: 0,
      flash: 0,
    };
  }

  private updateBoss(dt: number) {
    const boss = this.boss;
    if (!boss) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.spawnBoss();
      }
      return;
    }
    const bay = this.bossBay(boss.side);
    if (!bay) {
      // the layout changed under it; it simply leaves
      this.boss = null;
      this.bossTimer = between(BATTLE_BOSS_INTERVAL_S);
      return;
    }
    boss.phaseTime += dt;
    boss.flash = Math.max(0, boss.flash - dt);
    const raging = boss.hp < BATTLE_BOSS_HP / 3;
    let spin = raging ? 2.2 : 0.8;
    let tx = boss.x;
    let ty = boss.y;
    if (boss.phase === "enter") {
      const t = Math.min(1, boss.phaseTime / BATTLE_BOSS_ENTER_S);
      const ease = 1 - (1 - t) ** 3;
      tx = boss.startX + (bay.x - boss.startX) * ease;
      ty = bay.y;
      spin = 3 * (1 - ease) + 0.8;
      if (t >= 1) {
        boss.phase = "fight";
        boss.phaseTime = 0;
      }
    } else if (boss.phase === "fight") {
      boss.clock += dt * (raging ? 1.6 : 1);
      tx = bay.x + Math.sin(boss.clock * 0.7) * bay.rx;
      ty = bay.y + Math.sin(boss.clock * 1.3) * bay.ry;
      this.bossAttack(boss, raging, dt);
    } else {
      spin = 6;
      ty = boss.y + 6 * dt;
      tx = boss.x + (Math.random() - 0.5) * 0.6;
      boss.blastClock -= dt;
      if (boss.blastClock <= 0) {
        boss.blastClock = 0.11;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * BATTLE_BOSS_RADIUS;
        this.blast(
          boss.x + Math.cos(a) * r,
          boss.y + Math.sin(a) * r,
          BATTLE_BOSS_FACTION,
          0.55
        );
        this.shake = Math.max(this.shake, 1.2);
      }
      if (boss.phaseTime >= BATTLE_BOSS_DYING_S) {
        this.bossFinale(boss);
        return;
      }
    }
    boss.angle += spin * dt;
    boss.vx = dt > 0 ? (tx - boss.x) / dt : 0;
    boss.vy = dt > 0 ? (ty - boss.y) / dt : 0;
    boss.x = tx;
    boss.y = ty;
  }

  private bossAttack(boss: BattleBoss, raging: boolean, dt: number) {
    if (boss.spiralTime > 0) {
      boss.spiralTime -= dt;
      boss.spiralClock -= dt;
      while (boss.spiralClock <= 0) {
        boss.spiralClock += BATTLE_BOSS_SPIRAL_GAP_S;
        const a = boss.angle * 2.4;
        this.heavyBolt(boss, a);
        this.heavyBolt(boss, a + Math.PI);
        if (raging) {
          this.heavyBolt(boss, a + Math.PI / 2);
          this.heavyBolt(boss, a - Math.PI / 2);
        }
      }
      return;
    }
    boss.attackTimer -= dt;
    if (boss.attackTimer > 0) {
      return;
    }
    boss.attackTimer = between(
      raging ? BATTLE_BOSS_RAGE_ATTACK_S : BATTLE_BOSS_ATTACK_S
    );
    const attack = boss.attack % 3;
    boss.attack += 1;
    if (attack === 0) {
      // ring of fire
      const offset = Math.random() * Math.PI * 2;
      const count = raging
        ? BATTLE_BOSS_RING_BOLTS + 8
        : BATTLE_BOSS_RING_BOLTS;
      for (let i = 0; i < count; i += 1) {
        this.heavyBolt(boss, offset + (i / count) * Math.PI * 2);
      }
      this.rings.push({
        x: boss.x,
        y: boss.y,
        life: 0.3,
        max: 0.3,
        r: BATTLE_BOSS_RADIUS + 6,
        tone: WHITE,
      });
      this.shake = Math.max(this.shake, 0.5);
    } else if (attack === 1) {
      boss.spiralTime = BATTLE_BOSS_SPIRAL_S;
      boss.spiralClock = 0;
    } else {
      // a volley of homing missiles at the first three enemies, four once raging
      const enemies = this.ships
        .map((ship, index) => ({ ship, index }))
        .filter(
          ({ ship }) =>
            ship.faction !== BATTLE_BOSS_FACTION && ship.respawn <= 0
        )
        .slice(0, raging ? 4 : 3);
      for (const { ship, index } of enemies) {
        const heading =
          Math.atan2(ship.y - boss.y, ship.x - boss.x) +
          (Math.random() - 0.5) * 1.6;
        this.missiles.push({
          faction: BATTLE_BOSS_FACTION,
          target: index,
          x: boss.x + Math.cos(heading) * BATTLE_BOSS_RADIUS,
          y: boss.y + Math.sin(heading) * BATTLE_BOSS_RADIUS,
          heading,
          speed: BATTLE_MISSILE_SPEED[0],
          life: BATTLE_MISSILE_LIFE,
        });
      }
    }
  }

  private heavyBolt(boss: BattleBoss, angle: number) {
    this.bolts.push({
      faction: BATTLE_BOSS_FACTION,
      x: boss.x + Math.cos(angle) * BATTLE_BOSS_RADIUS,
      y: boss.y + Math.sin(angle) * BATTLE_BOSS_RADIUS,
      vx: Math.cos(angle) * BATTLE_HEAVY_BOLT_SPEED,
      vy: Math.sin(angle) * BATTLE_HEAVY_BOLT_SPEED,
      life: BATTLE_HEAVY_BOLT_LIFE,
      heavy: true,
    });
  }

  private bossAt(x: number, y: number, faction: number) {
    const boss = this.boss;
    return (
      boss !== null &&
      boss.phase !== "dying" &&
      faction !== BATTLE_BOSS_FACTION &&
      Math.hypot(boss.x - x, boss.y - y) < BATTLE_BOSS_RADIUS
    );
  }

  private hitBoss(amount: number, x: number, y: number) {
    const boss = this.boss;
    if (!boss || boss.phase === "dying") {
      return;
    }
    boss.hp -= amount;
    boss.flash = 0.07;
    this.burst(x, y, 6, 45, [WHITE, ...FIRE.slice(0, 3)], 0.35);
    if (boss.hp > 0) {
      return;
    }
    boss.phase = "dying";
    boss.phaseTime = 0;
    boss.spiralTime = 0;
    // its bullets fizzle out with it. They expire rather than being filtered out here, because this
    // can run inside moveBolts(), whose own filter would put them back.
    for (const bolt of this.bolts) {
      if (bolt.heavy && bolt.life > 0) {
        bolt.life = 0;
        this.burst(bolt.x, bolt.y, 2, 14, [BATTLE_BOSS_FACTION, WHITE], 0.35);
      }
    }
  }

  /** The big one: a huge fireball, shockwaves, a shower of wreckage and a hard shake. */
  private bossFinale(boss: BattleBoss) {
    this.blast(boss.x, boss.y, BATTLE_BOSS_FACTION, 2.6);
    this.burst(boss.x, boss.y, 30, 50, [WHITE, ...FIRE], 1.1);
    this.rings.push({
      x: boss.x,
      y: boss.y,
      life: 1.1,
      max: 1.1,
      r: 70,
      tone: WHITE,
    });
    for (let i = 0; i < 22; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 25 + Math.random() * 60;
      const life = 1 + Math.random() * 0.9;
      this.particles.push({
        size: 2,
        x: boss.x + Math.cos(a) * 6,
        y: boss.y + Math.sin(a) * 6,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        tone: BATTLE_BOSS_FACTION,
      });
    }
    this.shake = 3;
    this.boss = null;
    this.bossTimer = between(BATTLE_BOSS_INTERVAL_S);
    for (const ship of this.ships) {
      if (ship.target === BATTLE_BOSS_TARGET) {
        ship.target = -1;
      }
    }
  }
}
