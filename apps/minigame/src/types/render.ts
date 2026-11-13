import type { ModelId, Rgb } from "@/types/game";

export interface ModelSprites {
  id: ModelId;
  /** The small ship, outlined; the canvas is SPRITE_SIZE + 2 across. */
  ship: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  /** The boss, one frame per step of its spin; BOSS_SIZE + 2 across. */
  boss: HTMLCanvasElement[];
  bossFlash: HTMLCanvasElement[];
}

export type SpriteSheet = Record<ModelId, ModelSprites>;

/** A colour resolved when drawing: a model's colour or a fixed one. */
export type Tone = Rgb | ModelId;

export interface Particle {
  size: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  tone: Tone;
}

export interface Ring {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
  tone: Tone;
}

/** Score popups and pickup labels that drift up and fade. */
export interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: Rgb;
}

export interface Banner {
  title: string;
  sub: string;
  life: number;
  max: number;
  color: Rgb;
}

export interface Star {
  x: number;
  y: number;
  depth: number;
  phase: number;
}

export interface Ghost {
  model: ModelId;
  x: number;
  y: number;
  life: number;
}

/** What the screen needs besides the game itself: the pointer and the touch sticks, in art pixels. */
export interface Overlay {
  reticle: { x: number; y: number } | null;
  sticks: { x: number; y: number; dx: number; dy: number }[];
  /** Draws the HUD; off while the menu's demo plays behind it. */
  hud: boolean;
}
