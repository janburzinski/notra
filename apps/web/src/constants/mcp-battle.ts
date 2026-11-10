import type { BattleFaction, BattleTheme } from "@/types/mcp-battle";

/** CSS pixels per art pixel. The canvas is drawn this coarse and scaled up without smoothing. */
export const BATTLE_ART_PX = 3;

/** Logos are rasterised to this many art pixels across. */
export const BATTLE_SPRITE_SIZE = 13;

/** Claude, ChatGPT, Cursor. Ships refer to a side by its index, and BATTLE_BOSS_FACTION points at Claude. */
export const BATTLE_FACTIONS: BattleFaction[] = [
  {
    logoSrc: "/logos/ai-engines/claude.svg",
    light: [217, 119, 87],
    dark: [232, 142, 112],
  },
  {
    logoSrc: "/logos/ai-engines/openai.svg",
    light: [16, 163, 127],
    dark: [52, 211, 153],
  },
  {
    logoSrc: "/mcp/cursor.svg",
    light: [37, 99, 235],
    dark: [96, 165, 250],
  },
];

export const BATTLE_LIGHT_THEME: BattleTheme = {
  dark: false,
  star: [124, 92, 214],
  smoke: [150, 136, 184],
  notra: [124, 58, 237],
};

export const BATTLE_DARK_THEME: BattleTheme = {
  dark: true,
  star: [237, 228, 255],
  smoke: [112, 98, 150],
  notra: [167, 139, 250],
};

/** Art pixels of hero per ship: a big hero gets more ships, but never crowded. */
export const BATTLE_AREA_PER_SHIP = 9000;
export const BATTLE_SHIPS_PER_FACTION: readonly [number, number] = [1, 2];

// Flight model, in art pixels and seconds. Ships fly where they point and turn at a limited rate,
// so every change of course is a curve.
export const BATTLE_CRUISE_SPEED = 58;
export const BATTLE_MIN_SPEED = 36;
export const BATTLE_BOOST_SPEED = 84;
export const BATTLE_THROTTLE = 70;
/** Radians per second. */
export const BATTLE_TURN_RATE = 3.6;
/** How quickly velocity catches up with the nose, per second; lower slides more. */
export const BATTLE_GRIP = 5;
/** Ships look this far ahead, in seconds, to steer clear of walls and the headline. */
export const BATTLE_LOOKAHEAD_S = 0.55;

/** A strafing run lasts this long before the ship peels off. */
export const BATTLE_ATTACK_S: readonly [number, number] = [2.5, 5];
export const BATTLE_BREAK_S: readonly [number, number] = [0.7, 1.4];
/** Closer than this the attacker overshoots and breaks away. */
export const BATTLE_BREAK_DISTANCE = 22;
export const BATTLE_EVADE_S = 0.4;
export const BATTLE_EVADE_RADIUS = 26;

export const BATTLE_FIRE_RANGE = 115;
/** Fire only when the target sits inside this cone off the nose. */
export const BATTLE_FIRE_CONE = 0.2;
export const BATTLE_BURST_SHOTS = 3;
export const BATTLE_BURST_GAP_S = 0.075;
export const BATTLE_BURST_COOLDOWN: readonly [number, number] = [0.6, 1.4];
export const BATTLE_BOLT_SPEED = 170;
export const BATTLE_BOLT_LIFE = 1.1;
export const BATTLE_BOLT_LENGTH = 6;
export const BATTLE_AIM_JITTER = 0.05;

export const BATTLE_MISSILE_COOLDOWN: readonly [number, number] = [4, 8];
export const BATTLE_MISSILE_SPEED: readonly [number, number] = [30, 125];
export const BATTLE_MISSILE_ACCEL = 170;
export const BATTLE_MISSILE_TURN = 2.7;
export const BATTLE_MISSILE_LIFE = 3;

export const BATTLE_HIT_RADIUS = 6;
export const BATTLE_SHIP_HP = 4;
export const BATTLE_MISSILE_DAMAGE = 2;
export const BATTLE_RESPAWN_S: readonly [number, number] = [1.8, 3.2];
export const BATTLE_SEPARATION = 28;
/** Extra room the ships give the headline block, in art pixels. */
export const BATTLE_AVOID_PADDING = 12;
export const BATTLE_EDGE_MARGIN = 8;
/** Radians per frame a ship's nose swings along a wall it slid into. */
export const BATTLE_WALL_TURN = 0.2;
/** The site nav sits over the top of the hero: no ship's centre goes above this line. */
export const BATTLE_TOP_MARGIN = 27;
/** The narrowest open strip beside the headline that still gets ships; narrower heroes only show stars. */
export const BATTLE_MIN_BAY = 40;

/** Engine trail samples kept per ship, one every TRAIL_STEP_S. */
export const BATTLE_TRAIL_LENGTH = 12;
export const BATTLE_TRAIL_STEP_S = 0.025;

export const BATTLE_AREA_PER_STAR = 700;
export const BATTLE_STAR_DRIFT = 2.5;

// The boss: a giant Claude that parks in a side bay and sprays bullets until the others shoot it down.
/** Index into BATTLE_FACTIONS: the boss fights for Claude, so Claude ships escort it. */
export const BATTLE_BOSS_FACTION = 0;
/** A ship's `target` while it attacks the boss. */
export const BATTLE_BOSS_TARGET = -2;
export const BATTLE_BOSS_SIZE = 31;
export const BATTLE_BOSS_FRAMES = 24;
export const BATTLE_BOSS_RADIUS = 13;
export const BATTLE_BOSS_HP = 13;
export const BATTLE_BOSS_FIRST_S = 7;
export const BATTLE_BOSS_INTERVAL_S: readonly [number, number] = [30, 45];
export const BATTLE_BOSS_ENTER_S = 2.2;
export const BATTLE_BOSS_DYING_S = 2.4;
export const BATTLE_BOSS_ATTACK_S: readonly [number, number] = [1.8, 2.6];
/** Attack gaps once it's below a third of its health. */
export const BATTLE_BOSS_RAGE_ATTACK_S: readonly [number, number] = [1, 1.5];
export const BATTLE_BOSS_RING_BOLTS = 16;
export const BATTLE_BOSS_SPIRAL_S = 1.4;
export const BATTLE_BOSS_SPIRAL_GAP_S = 0.07;
/** Burst cooldown multiplier for ships shooting at the boss. */
export const BATTLE_BOSS_FIRE_RATE = 0.45;
/** Share of non-Claude ships that go after the boss instead of each other. */
export const BATTLE_BOSS_FOCUS = 0.8;
export const BATTLE_HEAVY_BOLT_SPEED = 72;
export const BATTLE_HEAVY_BOLT_LIFE = 2.6;

// Clicking empty sky drops a Notra strike.
export const BATTLE_STRIKE_RADIUS = 16;
export const BATTLE_STRIKE_DAMAGE = 2;
export const BATTLE_STRIKE_BOSS_DAMAGE = 5;

/** Under reduced motion the fight is simulated this far and shown as a still. */
export const BATTLE_STILL_S = 6;
