import type { OllieMood } from "@/types/autopilot-onboarding";

/** Ollie's palette: lavender body, ink eyes, pink cheeks. */
export const OLLIE_COLORS = {
  b: "#C8B2EE",
  h: "#E6DBF8",
  d: "#A88BD9",
  e: "#1E1E1E",
  w: "#FFFFFF",
  c: "#F4A9C6",
} as const;

/** Head, 16 wide; rows 12 to 15 are the tentacles. */
export const OLLIE_HEAD = [
  "................",
  "................",
  ".....bbbbbb.....",
  "...bbbbbbbbbb...",
  "..bbhhbbbbbbbb..",
  "..bhhbbbbbbbbb..",
  ".bbhbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  "..bbbbbbbbbbbb..",
  "..dbbbbbbbbbbd..",
] as const;

/** Two tentacle poses; swapping them is the wiggle. */
export const OLLIE_TENTACLES = [
  [
    "..bb.bb..bb.bb..",
    ".bd..bd..db..db.",
    ".b....b..b....b.",
    "................",
  ],
  [
    "..bb.bb..bb.bb..",
    "..bd.bd..db.db..",
    "...b..b..b..b...",
    "................",
  ],
] as const;

type Pixel = readonly [x: number, y: number, color: keyof typeof OLLIE_COLORS];

export const OLLIE_EYES = {
  open: [
    [4, 7, "w"],
    [5, 7, "e"],
    [4, 8, "e"],
    [5, 8, "e"],
    [10, 7, "w"],
    [11, 7, "e"],
    [10, 8, "e"],
    [11, 8, "e"],
  ],
  closed: [
    [4, 8, "e"],
    [5, 8, "e"],
    [10, 8, "e"],
    [11, 8, "e"],
  ],
  /** Looking up and away, like someone thinking. */
  thinking: [
    [5, 6, "w"],
    [6, 6, "e"],
    [5, 7, "e"],
    [6, 7, "e"],
    [11, 6, "w"],
    [12, 6, "e"],
    [11, 7, "e"],
    [12, 7, "e"],
  ],
  happy: [
    [3, 8, "e"],
    [4, 7, "e"],
    [5, 8, "e"],
    [10, 8, "e"],
    [11, 7, "e"],
    [12, 8, "e"],
  ],
} as const satisfies Record<string, readonly Pixel[]>;

export const OLLIE_CHEEKS = [
  [2, 9, "c"],
  [3, 9, "c"],
  [12, 9, "c"],
  [13, 9, "c"],
] as const satisfies readonly Pixel[];

export const OLLIE_MOUTHS = {
  closed: [
    [7, 10, "e"],
    [8, 10, "e"],
  ],
  open: [
    [7, 10, "e"],
    [8, 10, "e"],
    [7, 11, "e"],
    [8, 11, "e"],
  ],
  /** A small sideways mouth while he thinks. */
  pursed: [[9, 10, "e"]],
} as const satisfies Record<string, readonly Pixel[]>;

/** The thought bubble over his head, one more dot per beat, outside the 16 by 16 grid. */
export const OLLIE_THOUGHT_DOTS = [
  [14, 2, "d"],
  [15, 0, "d"],
  [16, -2, "d"],
] as const satisfies readonly Pixel[];

/** How fast each mood moves: tentacle swap, mouth flap and bob, in ms. */
export const OLLIE_TEMPO = {
  idle: { tentacles: 900, mouth: 0, bob: 3200, lift: 0.25 },
  talking: { tentacles: 600, mouth: 140, bob: 2400, lift: 0.25 },
  thinking: { tentacles: 1100, mouth: 360, bob: 3200, lift: 0.15 },
  working: { tentacles: 300, mouth: 0, bob: 1600, lift: 0.2 },
  happy: { tentacles: 400, mouth: 0, bob: 1400, lift: 0.4 },
} as const satisfies Record<
  OllieMood,
  { tentacles: number; mouth: number; bob: number; lift: number }
>;

/** Ollie blinks every few seconds, for this long, when idle or talking. */
export const OLLIE_BLINK_EVERY_MS = 3600;
export const OLLIE_BLINK_MS = 140;

/** Ollie glides to the line he's saying and settles without overshooting. */
export const OLLIE_HOP_SPRING = { stiffness: 200, damping: 30, mass: 1 };
/** A hint of stretch while he moves, at this many px a second. */
export const OLLIE_SQUASH = { speed: 2000, stretch: 1.05, squash: 0.97 };
/** The chat's width from which Ollie shows beside it (@4xl, 56rem). */
export const OLLIE_VISIBLE_FROM_PX = 896;
/** Ollie beside the chat is 40px square (size-10). */
export const OLLIE_SIZE_PX = 40;
/** Where his head's middle sits in his 40px box, to line up with text. */
export const OLLIE_HEAD_CENTER_PX = 17;
/** Frames his line must stay below the chat's edge before he stops at it. */
export const OLLIE_CLAMP_AFTER_FRAMES = 3;
/** Sparkles when setup is done: how many, how far they fly. */
export const OLLIE_SPARKLES = { count: 10, distance: 34, seconds: 0.9 };

/**
 * The dive into the agent dock at the end: how far right he swims (from the
 * chat's left gutter to the dock's "+"), where the dock's middle sits above
 * the bottom, and how small he gets before he pops.
 */
export const OLLIE_DIVE = { x: 64, dockMiddleFromBottom: 40, shrink: 0.35 };
