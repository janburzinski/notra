import type { ModelId, Rgb } from "@/types/game";

/**
 * Hand-drawn 15×15 pixel art for each model's ship, after its logo. Drawn rather than rasterised from
 * the SVGs, which turn to mush at this size. `#` is the model's colour, `+` a lit and `-` a shaded
 * tone of it, `.` is empty. Any other letter is a colour the model names in SHIP_TONES. Bosses are the
 * same art at twice the size.
 */
export const SHIP_ART: Record<ModelId, readonly string[]> = {
  claude: [
    ".......#.......",
    "..#....#....#..",
    "...#...#...#...",
    "....#..#..#....",
    "##...#.#.#...#.",
    "..##.#####.##..",
    "....#++####....",
    "######+########",
    "....#####--....",
    "..##.###-#.##..",
    ".#...#.#.#...##",
    "....#..#..#....",
    "...#...#...#...",
    "..#....#....#..",
    ".......#.......",
  ],
  chatgpt: [
    ".......#.......",
    "......###......",
    "....###..##....",
    "..##..#....##..",
    ".#....#.######.",
    ".##..####....#.",
    ".#.#.#...#...#.",
    ".#..#.....#..#.",
    ".#...#...#.#.#.",
    ".#....####..##.",
    ".######.#....#.",
    "..##....#..##..",
    "....##..###....",
    "......###......",
    ".......#.......",
  ],
  // the hexagon with the pale wedge cut into its top face
  cursor: [
    ".......#.......",
    ".....#####.....",
    "...#########...",
    ".#############.",
    ".#+++++++++++#.",
    ".###++++++++##.",
    ".#####++++++##.",
    ".#######+++###.",
    ".#######+++###.",
    ".#######++####.",
    ".#######++####.",
    ".#######+#####.",
    "...#####+###...",
    ".....#####.....",
    ".......#.......",
  ],
  // the sparkle: thin points that swell into a full centre, so its sides curve inwards. Red on top,
  // yellow left, green below, blue through the middle and right
  gemini: [
    ".......r.......",
    ".......r.......",
    "......rrr......",
    "......rrr......",
    ".....rrrbb.....",
    "....rrbbbbb....",
    "..yyybbbbbbbb..",
    "yyyybbbbbbbbbbb",
    "..yygbbbbbbbb..",
    "....ggbbbbb....",
    ".....gggbb.....",
    "......ggg......",
    "......ggg......",
    ".......g.......",
    ".......g.......",
  ],
  grok: [
    "..............#",
    ".............#.",
    ".....#####..#..",
    "...######..##..",
    "...##.....##...",
    "..##.....####..",
    "..##....##.##..",
    "..##...##..##..",
    "..##..##...##..",
    "..##.##....##..",
    "...##.....##...",
    "...#..######...",
    "..#..#####.....",
    ".#.............",
    "#..............",
  ],
  perplexity: [
    ".......#.......",
    "...#...#...#...",
    "...##..#..##...",
    "...#.#.#.#.#...",
    ".#############.",
    ".#....###....#.",
    ".#...#.#.#...#.",
    ".#..#..#..#..#.",
    ".#.#...#...#.#.",
    ".###...#...###.",
    "...#..###..#...",
    "...#.#.#.#.#...",
    "...##..#..##...",
    "...#...#...#...",
    ".......#.......",
  ],
};

/**
 * Logos that are more than one colour spell their tones out. Gemini's sparkle has a colour per point,
 * and Cursor's wedge is near white against the body.
 */
export const SHIP_TONES: Partial<Record<ModelId, Record<string, Rgb>>> = {
  cursor: {
    "#": [59, 130, 246],
    "+": [236, 242, 255],
  },
  gemini: {
    r: [250, 67, 64],
    y: [246, 192, 19],
    g: [20, 187, 105],
    b: [49, 134, 255],
  },
};
