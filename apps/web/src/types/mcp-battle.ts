import type { RefObject } from "react";

export type Rgb = readonly [number, number, number];

/** One side of the fight: its logo, drawn as a pixel sprite, and its colour in each theme. */
export interface BattleFaction {
  logoSrc: string;
  light: Rgb;
  dark: Rgb;
}

export interface BattleTheme {
  dark: boolean;
  star: Rgb;
  smoke: Rgb;
  /** The visitor's own shots, in Notra violet. */
  notra: Rgb;
}

/** A colour that is resolved when drawing: a faction index, the theme's smoke or Notra violet, or a fixed colour. */
export type BattleTone = Rgb | number | "smoke" | "notra";

/** A rectangle in art pixels the ships keep out of, so they fight around the headline. */
export interface BattleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type BattleShipMode = "attack" | "break" | "evade";

interface BattlePoint {
  x: number;
  y: number;
}

export interface BattleShip {
  faction: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where the nose points, in radians. Ships fly along it and turn at a limited rate. */
  heading: number;
  speed: number;
  hp: number;
  target: number;
  mode: BattleShipMode;
  /** Seconds left in the current mode. */
  modeTime: number;
  /** Course to hold while breaking away or jinking. */
  modeAngle: number;
  /** Shots left in the current burst, and the time until the next one. */
  burst: number;
  burstTimer: number;
  burstCooldown: number;
  missileCooldown: number;
  /** Seconds until a destroyed ship flies back in; 0 while alive. */
  respawn: number;
  /** Seconds left of the white flash after a hit. */
  flash: number;
  trail: BattlePoint[];
  trailClock: number;
}

export interface BattleMissile {
  faction: number;
  target: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  life: number;
}

export interface BattleBolt {
  faction: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** The boss's slow, fat bullets. */
  heavy: boolean;
}

export interface BattleParticle {
  /** Debris is drawn as a 2×2 chunk instead of a single pixel. */
  size: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** A faction index takes that faction's colour in the current theme, "smoke" the theme's smoke. */
  tone: BattleTone;
}

export interface BattleRing {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
  tone: BattleTone;
}

export interface BattleStar {
  x: number;
  y: number;
  /** Nearer stars drift faster and shine brighter. */
  depth: number;
  phase: number;
}

type BattleBossPhase = "enter" | "fight" | "dying";

/** The giant Claude that shows up now and then, parks in one of the side bays and sprays bullets. */
export interface BattleBoss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where it flew in from, off the side of the hero. */
  startX: number;
  /** -1 for the left bay, 1 for the right. */
  side: 1 | -1;
  hp: number;
  phase: BattleBossPhase;
  phaseTime: number;
  /** Drives its patrol loop while fighting. */
  clock: number;
  /** Spin, in radians. */
  angle: number;
  attack: number;
  attackTimer: number;
  spiralTime: number;
  spiralClock: number;
  /** Seconds until the next explosion while it breaks apart. */
  blastClock: number;
  flash: number;
}

export interface BattleBay {
  x: number;
  y: number;
  /** How far the boss may sway from the centre of the bay. */
  rx: number;
  ry: number;
}

export interface BattleCanvasOptions {
  dark: boolean;
  reducedMotion: boolean;
}

export interface BattleCanvasRefs {
  /** Ships stay clear of this element. */
  avoidRef: RefObject<HTMLElement | null>;
  /** Clicks on empty parts of this element fire a Notra strike. */
  areaRef: RefObject<HTMLElement | null>;
}

/** Ships drawn in their faction colour, and the same shapes in white for the hit flash. */
export interface BattleSprites {
  tinted: (HTMLCanvasElement | undefined)[];
  flash: (HTMLCanvasElement | undefined)[];
  /** The boss, one frame per step of its spin. */
  boss: HTMLCanvasElement[];
  bossFlash: HTMLCanvasElement[];
}

export interface BattleMasks {
  ships: (Uint8Array | null)[];
  /** One mask per spin frame, empty when the logo failed to load. */
  boss: Uint8Array[];
}
