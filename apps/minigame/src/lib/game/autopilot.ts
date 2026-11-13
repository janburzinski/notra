import { ARENA_H, ARENA_W } from "@/constants/game";
import { AIM_STEPS } from "@/constants/replay";
import type { Game } from "@/lib/game/sim";
import type { TickInput } from "@/types/game";

const TAU = Math.PI * 2;
/** How far ahead, in seconds, it checks for walls. */
const WALL_LOOKAHEAD_S = 0.7;
const WALL_MARGIN = 18;

function steerIndex(angle: number) {
  return (
    ((Math.round((angle / TAU) * AIM_STEPS) % AIM_STEPS) + AIM_STEPS) %
    AIM_STEPS
  );
}

function angleDiff(to: number, from: number) {
  let d = (to - from) % TAU;
  if (d > Math.PI) {
    d -= TAU;
  } else if (d <= -Math.PI) {
    d += TAU;
  }
  return d;
}

/**
 * Flies the ship behind the menu (and in tests): chases the nearest enemy with some lead, breaks off to
 * dodge bullets and walls, brakes to turn tight up close and fires when the target crosses the nose.
 */
export function autopilotInput(game: Game): TickInput {
  const p = game.player;
  let target: { x: number; y: number; vx: number; vy: number } | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const enemy of game.enemies) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < best) {
      best = d;
      target = enemy;
    }
  }
  if (game.boss && (best > 80 || !target)) {
    target = game.boss;
    best = Math.hypot(game.boss.x - p.x, game.boss.y - p.y);
  }

  let desired = p.heading;
  let throttle: -1 | 0 | 1 = 0;
  if (target) {
    const lead = best / 300;
    desired = Math.atan2(
      target.y + target.vy * lead - p.y,
      target.x + target.vx * lead - p.x
    );
    if (best < 50) {
      throttle = -1;
    } else if (best > 120) {
      throttle = 1;
    }
  }

  // incoming fire: turn across it and punch out
  let threat: number | null = null;
  let closest = Number.POSITIVE_INFINITY;
  for (const bullet of game.bullets) {
    if (bullet.owner !== "enemy") {
      continue;
    }
    const dx = p.x - bullet.x;
    const dy = p.y - bullet.y;
    const d = Math.hypot(dx, dy);
    if (d < 26 && dx * bullet.vx + dy * bullet.vy > 0 && d < closest) {
      closest = d;
      threat = Math.atan2(bullet.vy, bullet.vx);
    }
  }
  if (threat !== null) {
    const left = threat - Math.PI / 2;
    const right = threat + Math.PI / 2;
    desired =
      Math.abs(angleDiff(left, p.heading)) <
      Math.abs(angleDiff(right, p.heading))
        ? left
        : right;
    throttle = 1;
  }

  // don't fly into anything
  for (const enemy of game.enemies) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const d = Math.hypot(dx, dy);
    const bearing = Math.atan2(dy, dx);
    if (d < 24 && Math.abs(angleDiff(bearing, p.heading)) < 1) {
      desired = bearing + (angleDiff(bearing, p.heading) > 0 ? -1.6 : 1.6);
      throttle = -1;
    }
  }

  const boss = game.boss;
  if (boss) {
    const dx = boss.x - p.x;
    const dy = boss.y - p.y;
    const d = Math.hypot(dx, dy);
    const bearing = Math.atan2(dy, dx);
    // the boss sweeps across the arena: stay out of its way from any side
    if (d < 52) {
      desired = bearing + Math.PI;
      throttle = 1;
    } else if (d < 80 && Math.abs(angleDiff(bearing, p.heading)) < 0.9) {
      desired = bearing + (angleDiff(bearing, p.heading) > 0 ? -1.4 : 1.4);
    }
  }

  // keep off the walls
  const ax = p.x + p.vx * WALL_LOOKAHEAD_S;
  const ay = p.y + p.vy * WALL_LOOKAHEAD_S;
  if (
    ax < WALL_MARGIN ||
    ax > ARENA_W - WALL_MARGIN ||
    ay < WALL_MARGIN ||
    ay > ARENA_H - WALL_MARGIN
  ) {
    desired = Math.atan2(ARENA_H / 2 - p.y, ARENA_W / 2 - p.x);
    throttle = -1;
  }

  return {
    steer: steerIndex(desired),
    steering: true,
    throttle,
    fire: true,
    dash: closest < 9 && p.dashCooldown <= 0,
    bomb: false,
  };
}
