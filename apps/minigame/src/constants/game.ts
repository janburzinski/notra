import type { PickupKind, Rgb } from "@/types/game";

// Everything is in art pixels and seconds. The arena is always this size, whatever the screen, so a
// run plays out the same in the browser and on the server that verifies it.
export const ARENA_W = 320;
export const ARENA_H = 180;
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Ships are SHIP_ART, this many art pixels across. Only the drawing uses these sizes. */
export const SPRITE_SIZE = 15;
/** Bosses are the ship art at BOSS_ART_SCALE, on a grid big enough to spin it without clipping. */
export const BOSS_ART_SCALE = 2;
export const BOSS_SIZE = 41;
export const BOSS_FRAMES = 24;

export const NOTRA_VIOLET: Rgb = [167, 139, 250];
export const WHITE: Rgb = [255, 255, 255];
export const DANGER: Rgb = [248, 113, 113];
export const GOLD: Rgb = [253, 224, 71];

// The player.
export const PLAYER_HITBOX = 2.5;
// Flight. Cruising speed and turn rate come from the model; these scale them.
export const BOOST_FACTOR = 1.5;
export const BRAKE_FACTOR = 0.45;
/** Speed change per second when boosting or braking. */
export const THROTTLE_ACCEL = 150;
/** How quickly velocity catches up with the nose, per second; lower drifts more. */
export const PLAYER_GRIP = 12;
/** Turn rate multiplier when braked, and how much of it full boost takes away. */
export const TURN_AT_SLOW = 1.4;
export const TURN_LOSS = 0.6;
export const PLAYER_MARGIN = 6;
export const DASH_TIME = 0.16;
export const DASH_SPEED = 300;
export const HIT_INVULN_S = 1.4;
export const SHIELD_INVULN_S = 0.8;
export const OVERDRIVE_S = 7;
export const OVERDRIVE_RATE = 1.6;
export const MAX_BOMBS = 3;
export const BOMB_RADIUS = 80;
export const BOMB_DAMAGE = 10;
export const BOMB_BOSS_DAMAGE = 18;
export const BOMB_COOLDOWN_S = 0.6;
/** Points for every enemy bullet a bomb wipes out. */
export const BOMB_BULLET_POINTS = 10;

// Enemies.
export const ENEMY_HITBOX = 6;
export const ENEMY_SEPARATION = 18;
/** Enemies that don't ram swerve away once this close to the player. */
export const ENEMY_PLAYER_CLEARANCE = 30;
/** Seconds after spawning before an enemy may shoot, so nothing fires the moment it appears. */
export const ENEMY_GRACE_S = 0.9;
export const SPAWN_WARNING_S = 1;
export const CONTACT_DAMAGE_TO_ENEMY = 4;
/** Ramming a normal ship: its damage, how hard both bounce and how long before it can happen again. */
export const RAM_DAMAGE = 3;
export const RAM_KNOCK = 90;
export const RAM_BUMP_S = 0.35;
export const CHARGE_WINDUP_S = 0.55;
export const CHARGE_TIME_S = 0.9;
export const CHARGE_SPEED = 175;
/** Radians per tick an enemy's nose swings along a wall it slid into. */
export const WALL_TURN = 0.2;

// Waves.
export const FIRST_WAVE_DELAY_S = 1.6;
export const INTERMISSION_S = 2.4;
export const BOSS_EVERY = 5;
export const SPAWN_GAP_S = 1.3;
/** From this wave on, some waves are swarms or aces instead of a normal mix. */
export const SPECIAL_WAVE_FROM = 3;
export const SPECIAL_WAVE_CHANCE = 0.45;
/** Swarms: more enemies of a single model, each with less health. */
export const SWARM_COUNT = 1.7;
export const SWARM_HP = 0.5;
export const SWARM_CAP_BONUS = 3;
/** Aces: a few elites with more health, faster fire, triple points and a guaranteed drop. */
export const ACE_COUNT = 0.4;
export const ACE_HP = 2.6;
export const ACE_FIRE = 1.5;
export const ACE_POINTS = 3;
/** From this wave on, normal waves turn some of their enemies into aces, more each wave. */
export const LATE_ACES_FROM = 7;
export const LATE_ACES_PER_WAVE = 0.04;
export const LATE_ACES_MAX = 0.45;
/** Most enemies alive at once outside swarms. */
export const MAX_ALIVE = 12;

// Score.
export const COMBO_WINDOW_S = 2.6;
export const COMBO_PER_STEP = 3;
export const MAX_MULTIPLIER = 8;
export const WAVE_CLEAR_POINTS = 250;
export const PERFECT_WAVE_POINTS = 250;
export const BOSS_POINTS = 2500;
/** A pickup the player can't use any more is worth this instead. */
export const SPARE_PICKUP_POINTS = 500;

// Pickups.
export const DROP_CHANCE = 0.13;
export const PICKUP_LIFE_S = 9;
export const PICKUP_MAGNET = 30;
export const PICKUP_GRAB = 9;
export const PICKUP_PULL_ACCEL = 500;
export const PICKUP_PULL_SPEED = 180;
export const PICKUP_WEIGHTS: readonly (readonly [PickupKind, number])[] = [
  ["repair", 3],
  ["overdrive", 3],
  ["shield", 2],
  ["bomb", 2],
];

// The boss.
export const BOSS_RADIUS = 13;
/** How hard flying into the boss throws you back. */
export const BOSS_KNOCK = 160;
export const BOSS_HP = 80;
/** Extra health per boss already beaten, as a share of BOSS_HP. */
export const BOSS_HP_GROWTH = 0.8;
export const BOSS_ENTER_S = 2.4;
export const BOSS_DYING_S = 2.2;
export const BOSS_ATTACK_S: readonly [number, number] = [1.9, 2.6];
export const BOSS_RAGE_ATTACK_S: readonly [number, number] = [1.3, 1.7];
export const BOSS_RING_BULLETS = 12;
export const BOSS_SPIRAL_S = 1.6;
export const BOSS_SPIRAL_GAP_S = 0.12;
export const BOSS_BULLET_SPEED = 56;
export const BOSS_BULLET_LIFE = 4;

/** Enemy bullets get this much faster per wave, up to ENEMY_BULLET_SPEEDUP_MAX. */
export const ENEMY_BULLET_SPEEDUP = 0.03;
export const ENEMY_BULLET_SPEEDUP_MAX = 0.7;
/** Enemy fire gets this much more frequent per wave, up to ENEMY_FIRE_SPEEDUP_MAX. */
export const ENEMY_FIRE_SPEEDUP = 0.06;
export const ENEMY_FIRE_SPEEDUP_MAX = 1.8;
/** Enemy health grows by this share per wave. */
export const ENEMY_HP_GROWTH = 0.11;
/** A quadratic term on top, so late waves keep up with an upgraded ship. */
export const ENEMY_HP_GROWTH_LATE = 0.005;

/** Longest run the server will replay: 45 minutes. */
export const MAX_RUN_TICKS = 45 * 60 * TICK_RATE;
