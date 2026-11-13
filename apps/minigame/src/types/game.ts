export type Rgb = readonly [number, number, number];

export type ModelId =
  | "claude"
  | "chatgpt"
  | "cursor"
  | "gemini"
  | "grok"
  | "perplexity";

/** How a weapon fires one trigger pull. */
type ShotPattern = "twin" | "spread" | "single" | "homing";

export interface WeaponSpec {
  pattern: ShotPattern;
  /** Trigger pulls per second. */
  rate: number;
  speed: number;
  damage: number;
  /** Bullets per pull for "spread", and the angle between them. */
  count: number;
  spread: number;
  /** Random aim wobble, in radians. */
  jitter: number;
  /** Enemies a bullet passes through before it stops. */
  pierce: number;
  /** Radians per second a homing bullet turns toward its target. */
  homing: number;
  /** Collision radius and drawn size. */
  radius: number;
  life: number;
}

/** How an enemy of this model flies and fights. */
type EnemyBehavior = "strafe" | "swarm" | "sniper" | "charger" | "lobber";

interface EnemySpec {
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  /** Radians per second. */
  turn: number;
  /** Distance it likes to keep from the player. */
  range: number;
  points: number;
  /** Shots per burst, the gap between them and the pause between bursts. */
  burst: number;
  burstGap: number;
  cooldown: readonly [number, number];
  weapon: WeaponSpec;
  /** First wave it can show up in. */
  unlockWave: number;
}

/** A 1–5 rating shown on the model picker. */
interface ModelRatings {
  firepower: number;
  speed: number;
  armor: number;
}

export interface ModelSpec {
  id: ModelId;
  name: string;
  maker: string;
  /** One line on the model picker about how it plays. */
  perk: string;
  color: Rgb;
  ratings: ModelRatings;
  hp: number;
  /** Cruising speed; boosting and braking scale it. */
  speed: number;
  /** How fast the nose turns, in radians per second at cruising speed. */
  turn: number;
  dashCooldown: number;
  bombs: number;
  weapon: WeaponSpec;
  enemy: EnemySpec;
}

/** One tick of input. `move` indexes the 16 compass directions, -1 is standing still. */
/**
 * One tick of input. The ship always flies forward; `steer` is where its nose should turn, 0–255
 * around the circle with 0 pointing right, and only counts while `steering` is set.
 */
export interface TickInput {
  steer: number;
  steering: boolean;
  /** 1 boosts, -1 brakes, 0 cruises. */
  throttle: -1 | 0 | 1;
  fire: boolean;
  dash: boolean;
  bomb: boolean;
}

export type UpgradeId =
  | "guns"
  | "rapid"
  | "heavy"
  | "velocity"
  | "pierce"
  | "seeker"
  | "hull"
  | "repair"
  | "afterburner"
  | "thrusters"
  | "strike"
  | "shieldgen"
  | "magnet"
  | "ram"
  | "combo";

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  /** What one more level does, in a few words. */
  effect: string;
  /** Highest level; Infinity for upgrades that can be taken again and again. */
  max: number;
  /** Only offered when the ship is damaged. */
  needsDamage: boolean;
  icon: readonly string[];
  color: Rgb;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where the nose points; the ship flies and fires this way. */
  heading: number;
  speed: number;
  /** -1 braking, 0 cruising, 1 boosting, for the thruster. */
  throttle: number;
  hp: number;
  maxHp: number;
  /** Seconds of invulnerability left after a hit. */
  invuln: number;
  dashTime: number;
  dashCooldown: number;
  dashAngle: number;
  fireTimer: number;
  /** Alternates the side a homing missile launches from. */
  fireSide: number;
  bombs: number;
  bombCooldown: number;
  shield: boolean;
  /** Seconds until the shield generator upgrade restores the shield. */
  shieldRegen: number;
  overdrive: number;
}

type EnemyMode = "enter" | "attack" | "break" | "windup" | "charge";

export interface Enemy {
  id: number;
  model: ModelId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  speed: number;
  hp: number;
  maxHp: number;
  mode: EnemyMode;
  modeTime: number;
  modeAngle: number;
  burst: number;
  burstTimer: number;
  cooldown: number;
  /** Which way it circles the player. */
  orbit: 1 | -1;
  flash: number;
  /** Seconds since it flew in. */
  age: number;
  /** Summoned by a boss: worth fewer points and drops nothing. */
  minion: boolean;
  /** An ace: tougher, shoots more, worth triple and always drops something. */
  elite: boolean;
  /** Seconds before the player can ram it again. */
  bump: number;
}

export type BulletOwner = "player" | "enemy";

export interface Bullet {
  owner: BulletOwner;
  model: ModelId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  pierce: number;
  homing: number;
  /** Seconds a homing bullet keeps steering. */
  homingTime: number;
  /** Enemies a piercing bullet already hit. */
  hits: number[];
  /** A boss's big slow bullet. */
  heavy: boolean;
}

export type PickupKind = "repair" | "bomb" | "overdrive" | "shield";

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

type BossPhase = "enter" | "fight" | "dying";

export interface Boss {
  model: ModelId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  phase: BossPhase;
  phaseTime: number;
  clock: number;
  angle: number;
  attack: number;
  attackTimer: number;
  spiralTime: number;
  spiralClock: number;
  blastClock: number;
  flash: number;
}

/** An enemy about to fly in; drawn as a warning at the edge. */
export interface PendingSpawn {
  model: ModelId;
  x: number;
  y: number;
  /** Seconds until it arrives. */
  delay: number;
  minion: boolean;
  elite: boolean;
}

type WavePhase = "intermission" | "fight" | "boss";

/** Normal waves mix rivals; swarms send many weak ones of one kind; aces send a few elites. */
export type WaveKind = "normal" | "swarm" | "aces";

export interface WaveState {
  number: number;
  phase: WavePhase;
  timer: number;
  /** Enemies of this wave still to spawn. */
  remaining: number;
  spawnTimer: number;
  /** Whether the player took no damage this wave. */
  clean: boolean;
  kind: WaveKind;
  /** The one model a swarm wave sends. */
  swarmModel: ModelId | null;
}

export type GameEvent =
  | { type: "shot"; x: number; y: number; model: ModelId; owner: BulletOwner }
  | { type: "hit"; x: number; y: number; model: ModelId }
  | { type: "kill"; x: number; y: number; model: ModelId; points: number }
  | { type: "playerHit"; x: number; y: number }
  | { type: "shieldBreak"; x: number; y: number }
  | { type: "playerDeath"; x: number; y: number }
  | { type: "dash"; x: number; y: number; angle: number }
  | { type: "bomb"; x: number; y: number; cleared: number }
  | { type: "fizzle"; x: number; y: number; model: ModelId }
  | { type: "pickup"; x: number; y: number; kind: PickupKind; points: number }
  | {
      type: "wave";
      number: number;
      boss: ModelId | null;
      kind: WaveKind;
      swarm: ModelId | null;
    }
  | { type: "waveClear"; number: number; points: number; perfect: boolean }
  | { type: "bossHit"; x: number; y: number }
  | { type: "bossBlast"; x: number; y: number }
  | { type: "bossDeath"; x: number; y: number; model: ModelId; points: number }
  | { type: "bossAttack"; x: number; y: number }
  | { type: "ram"; x: number; y: number }
  | { type: "upgrade"; id: UpgradeId; level: number };

export interface GameStats {
  score: number;
  wave: number;
  kills: number;
  bosses: number;
  ticks: number;
}

/** What the server works out from a replay. */
export interface RunResult extends GameStats {
  model: ModelId;
  over: boolean;
}
