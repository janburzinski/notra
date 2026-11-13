import type { PickupKind, Rgb } from "@/types/game";

export const SPACE: Rgb = [16, 11, 30];
export const STAR: Rgb = [237, 228, 255];
/** The thin line around the arena, a quarter of the way from SPACE to Notra violet. */
export const ARENA_EDGE: Rgb = [54, 43, 85];
/** The dark rim around every sprite, so ships read over bullets, stars and each other. */
export const RIM: Rgb = [10, 7, 20];
export const SMOKE: Rgb = [112, 98, 150];
export const FIRE: readonly Rgb[] = [
  [255, 247, 205],
  [253, 224, 71],
  [251, 146, 60],
  [234, 88, 12],
];

export const STAR_COUNT = 90;
export const SHAKE_STEP_S = 1 / 30;
/** How long the wave-clear banner stays up when it names the upgrade the ship just got. */
export const UPGRADE_BANNER_S = 2.8;
export const TRAIL_LENGTH = 10;
export const TRAIL_STEP_S = 1 / 40;

/** 7×7 icons for the pickups, drawn in the pickup's colour on a dark tile. */
export const PICKUP_ICONS: Record<PickupKind, readonly string[]> = {
  repair: [
    "..###..",
    "..###..",
    "#######",
    "#######",
    "#######",
    "..###..",
    "..###..",
  ],
  bomb: [
    "...##..",
    "..#....",
    ".#####.",
    "#######",
    "#######",
    "#######",
    ".#####.",
  ],
  overdrive: [
    "...###.",
    "..###..",
    ".###...",
    "######.",
    "..###..",
    ".###...",
    "##.....",
  ],
  shield: [
    "#######",
    "#.....#",
    "#.###.#",
    "#.###.#",
    ".#.#.#.",
    "..#.#..",
    "...#...",
  ],
};

export const PICKUP_COLORS: Record<PickupKind, Rgb> = {
  repair: [248, 113, 113],
  bomb: [167, 139, 250],
  overdrive: [253, 224, 71],
  shield: [125, 211, 252],
};

export const PICKUP_LABELS: Record<PickupKind, string> = {
  repair: "+1 HP",
  bomb: "+1 STRIKE",
  overdrive: "OVERDRIVE",
  shield: "SHIELD",
};

/**
 * The X logo on the fonts' pixel grid: 7×7 font pixels, a little taller than a capital, so it reads as
 * part of the label.
 */
export const X_LOGO_ART: readonly string[] = [
  "##....#",
  ".##..#.",
  "..###..",
  "...##..",
  "..#.##.",
  ".#...##",
  "#.....#",
];
