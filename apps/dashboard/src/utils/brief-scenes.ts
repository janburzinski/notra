/**
 * Pixel-art places for the top of the daily brief. Each scene is drawn into a
 * small RGBA buffer that the page scales up without smoothing; the brief's
 * day picks which one shows, so the view changes every morning.
 */

export const BRIEF_SCENE_COLS = 128;
export const BRIEF_SCENE_ROWS = 40;
/** Low on purpose: pixel art moves in steps, and it keeps the page idle. */
export const BRIEF_SCENE_FPS = 12;

type Rgb = readonly [number, number, number];

interface Canvas {
  set: (x: number, y: number, color: Rgb) => void;
  get: (x: number, y: number) => Rgb;
  data: Uint8ClampedArray<ArrayBuffer>;
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function hex(value: string): Rgb {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Keeps a moving thing on a loop: past the right edge it comes back left. */
function wrap(value: number, size: number) {
  return ((value % size) + size) % size;
}

function threshold(x: number, y: number) {
  return ((BAYER_4[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
}

/** Same numbers every time for a seed, so a scene always looks the same. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d_2b_79_f5) % 4_294_967_296;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createCanvas(): Canvas {
  const data = new Uint8ClampedArray(BRIEF_SCENE_COLS * BRIEF_SCENE_ROWS * 4);
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < BRIEF_SCENE_COLS && y < BRIEF_SCENE_ROWS;
  return {
    data,
    set(x, y, color) {
      const px = Math.round(x);
      const py = Math.round(y);
      if (!inside(px, py)) {
        return;
      }
      const i = (py * BRIEF_SCENE_COLS + px) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    },
    get(x, y) {
      const px = Math.min(Math.max(Math.round(x), 0), BRIEF_SCENE_COLS - 1);
      const py = Math.min(Math.max(Math.round(y), 0), BRIEF_SCENE_ROWS - 1);
      const i = (py * BRIEF_SCENE_COLS + px) * 4;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    },
  };
}

/** A dithered vertical gradient through `stops`, from `top` down to `bottom`. */
function sky(canvas: Canvas, stops: string[], top: number, bottom: number) {
  const colors = stops.map(hex);
  const span = Math.max(bottom - top - 1, 1);
  for (let y = top; y < bottom; y++) {
    const p = ((y - top) / span) * (colors.length - 1);
    const i = Math.min(Math.floor(p), colors.length - 2);
    const f = p - i;
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const color = f > threshold(x, y) ? colors[i + 1] : colors[i];
      if (color) {
        canvas.set(x, y, color);
      }
    }
  }
}

type Wave = readonly [amplitude: number, period: number, phase: number];

function ridge(x: number, base: number, waves: Wave[]) {
  let height = base;
  for (const [amplitude, period, phase] of waves) {
    height += amplitude * Math.sin(x / period + phase);
  }
  return Math.round(height);
}

/** Fills each column from the ridge line down to the bottom. */
function fillBelow(
  canvas: Canvas,
  height: (x: number) => number,
  paint: (x: number, y: number, depth: number) => Rgb | null
) {
  for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
    const top = height(x);
    for (let y = Math.max(top, 0); y < BRIEF_SCENE_ROWS; y++) {
      const color = paint(x, y, y - top);
      if (color) {
        canvas.set(x, y, color);
      }
    }
  }
}

function disc(canvas: Canvas, cx: number, cy: number, r: number, color: Rgb) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        canvas.set(x, y, color);
      }
    }
  }
}

/** Draws a sprite; "." is see-through, every other letter maps to a color. */
function sprite(
  canvas: Canvas,
  rows: string[],
  palette: Record<string, string>,
  x0: number,
  y0: number
) {
  for (const [dy, row] of rows.entries()) {
    for (const [dx, key] of [...row].entries()) {
      const color = palette[key];
      if (color) {
        canvas.set(x0 + dx, y0 + dy, hex(color));
      }
    }
  }
}

interface Peak {
  x: number;
  y: number;
}

/** Height of a jagged range: the lowest slope line from any peak. */
function peaks(x: number, list: Peak[], slope: number) {
  let best = Number.POSITIVE_INFINITY;
  let nearest = list[0] ?? { x: 0, y: 0 };
  for (const peak of list) {
    const height = peak.y + Math.abs(x - peak.x) * slope;
    if (height < best) {
      best = height;
      nearest = peak;
    }
  }
  return { height: Math.round(best + 0.6 * Math.sin(x * 1.7)), nearest };
}

function mountains(
  canvas: Canvas,
  list: Peak[],
  slope: number,
  snowline: number,
  colors: { rock: string; shade: string; snow: string; snowShade: string }
) {
  const rock = hex(colors.rock);
  const shade = hex(colors.shade);
  const snow = hex(colors.snow);
  const snowShade = hex(colors.snowShade);
  for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
    const { height, nearest } = peaks(x, list, slope);
    const lit = x <= nearest.x;
    const line = snowline + Math.round(1.2 * Math.sin(x / 3.3));
    for (let y = height; y < BRIEF_SCENE_ROWS; y++) {
      if (y < line) {
        canvas.set(x, y, lit ? snow : snowShade);
      } else {
        canvas.set(x, y, lit ? rock : shade);
      }
    }
  }
}

const SAGUARO = [
  "..g..",
  "..g.g",
  "g.g.g",
  "g.ggg",
  "ggg..",
  "..g..",
  "..g..",
  "..g..",
];

function desert(canvas: Canvas, t: number) {
  sky(canvas, ["#4b3f78", "#8a4f86", "#d0697a", "#f0936b", "#f9c784"], 0, 31);
  const streak = mix(hex("#f0936b"), hex("#fff1c4"), 0.45);
  for (const [x0, y, length, speed] of [
    [10, 9, 16, 1.2],
    [70, 13, 11, 0.8],
    [44, 5, 9, 1],
  ] as const) {
    const x = wrap(x0 + t * speed, BRIEF_SCENE_COLS + length) - length;
    for (let i = 0; i < length; i++) {
      canvas.set(x + i, y, streak);
    }
  }
  disc(canvas, 88, 23, 8.5, hex("#ffe29a"));
  disc(canvas, 88, 23, 6, hex("#fff1c4"));
  birds(
    canvas,
    t,
    [
      { x: 20, y: 11, speed: 5 },
      { x: 27, y: 13, speed: 5 },
    ],
    "#4b3150"
  );
  const mesa = hex("#8e4a5a");
  const mesaTop = hex("#a65b62");
  for (const [from, to, top] of [
    [6, 30, 20],
    [52, 60, 23],
    [104, 124, 19],
  ] as const) {
    for (let y = top; y < 31; y++) {
      const spread = Math.floor((y - top) * 0.7);
      for (let x = from - spread; x <= to + spread; x++) {
        canvas.set(x, y, y === top ? mesaTop : mesa);
      }
    }
  }
  const layers = [
    {
      base: 29,
      waves: [
        [1.5, 9, 1],
        [1, 4, 0],
      ] as Wave[],
      color: "#c9734f",
    },
    {
      base: 32,
      waves: [
        [2, 13, 2],
        [1, 5, 1],
      ] as Wave[],
      color: "#de9159",
    },
    {
      base: 35,
      waves: [
        [2, 17, 4],
        [0.8, 6, 0],
      ] as Wave[],
      color: "#efb36e",
    },
  ];
  for (const layer of layers) {
    const body = hex(layer.color);
    const crest = mix(body, hex("#fff1c4"), 0.35);
    fillBelow(
      canvas,
      (x) => ridge(x, layer.base, layer.waves),
      (_x, _y, depth) => (depth === 0 ? crest : body)
    );
  }
  const palette = { g: "#3d5c3a" };
  const near = layers[2];
  const mid = layers[1];
  if (near && mid) {
    sprite(canvas, SAGUARO, palette, 16, ridge(18, near.base, near.waves) - 7);
    sprite(
      canvas,
      SAGUARO,
      palette,
      106,
      ridge(108, near.base, near.waves) - 7
    );
    sprite(
      canvas,
      SAGUARO.slice(2),
      palette,
      70,
      ridge(72, mid.base, mid.waves) - 5
    );
  }
}

const PINE = [
  "...s...",
  "..ggg..",
  ".sgggs.",
  "..ggg..",
  ".ggggg.",
  "sgggggs",
  "...t...",
];

const PINE_TALL = [
  "....s....",
  "...ggg...",
  "..sgggs..",
  "...ggg...",
  "..ggggg..",
  ".sgggggs.",
  "..ggggg..",
  ".ggggggg.",
  "sgggggggs",
  "....t....",
];

function snowyPeaks(canvas: Canvas, t: number) {
  sky(canvas, ["#6fa8dc", "#9cc6ea", "#c9e1f4", "#e8f2fa"], 0, 32);
  mountains(
    canvas,
    [
      { x: 10, y: 10 },
      { x: 34, y: 6 },
      { x: 58, y: 12 },
      { x: 80, y: 5 },
      { x: 104, y: 9 },
      { x: 126, y: 7 },
    ],
    0.9,
    15,
    { rock: "#93a7c2", shade: "#7d92b0", snow: "#f1f6fb", snowShade: "#d3e0ee" }
  );
  mountains(
    canvas,
    [
      { x: 22, y: 16 },
      { x: 66, y: 13 },
      { x: 112, y: 15 },
    ],
    1.2,
    20,
    { rock: "#5f7493", shade: "#4c5f7c", snow: "#f7fafd", snowShade: "#c9d7e6" }
  );
  const snow = hex("#f2f7fc");
  const drift = hex("#d9e5f1");
  fillBelow(
    canvas,
    (x) =>
      ridge(x, 31, [
        [1, 10, 0],
        [0.6, 4, 1],
      ]),
    (x, y, depth) => (depth < 2 && threshold(x, y) < 0.5 ? drift : snow)
  );
  const palette = { g: "#2e4b45", s: "#eef4fa", t: "#4a3628" };
  for (const [x, tall] of [
    [4, true],
    [13, false],
    [30, false],
    [44, true],
    [86, true],
    [97, false],
    [118, true],
  ] as const) {
    const ground = ridge(x + 4, 31, [
      [1, 10, 0],
      [0.6, 4, 1],
    ]);
    sprite(
      canvas,
      tall ? PINE_TALL : PINE,
      palette,
      x,
      ground - (tall ? 8 : 5)
    );
  }
  const random = seeded(11);
  const flake = hex("#ffffff");
  for (let i = 0; i < 80; i++) {
    const x0 = random() * BRIEF_SCENE_COLS;
    const y0 = random() * BRIEF_SCENE_ROWS;
    const speed = 2 + random() * 3;
    canvas.set(
      wrap(x0 + Math.sin(t * 1.2 + i) * 1.5, BRIEF_SCENE_COLS),
      wrap(y0 + t * speed, BRIEF_SCENE_ROWS),
      flake
    );
  }
}

const CABIN = [
  "...rr...",
  "..rrrr..",
  ".rrrrrr.",
  "rrrrrrrr",
  ".bbbbbb.",
  ".bwbbdb.",
  ".bbbbdb.",
];

function northernLights(canvas: Canvas, t: number) {
  sky(canvas, ["#070b1f", "#0d1533", "#14214a", "#1d3060"], 0, 40);
  const random = seeded(5);
  const starColors = ["#ffffff", "#c9d6ff", "#fff3c4"].map(hex);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      if (random() < 0.025) {
        const color = starColors[Math.floor(random() * starColors.length)];
        const twinkle = hash(x, y, Math.floor(t * 2)) < 0.15;
        if (color && !twinkle) {
          canvas.set(x, y, color);
        }
      }
    }
  }
  const bright = hex("#8dffcf");
  const green = hex("#3ddc97");
  const teal = hex("#2a9d8f");
  const violet = hex("#7c5cd6");
  for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
    const edge =
      15 + 4 * Math.sin(x / 16 + 1 + t * 0.5) + 2 * Math.sin(x / 6 - t * 0.8);
    const streak = 0.75 + 0.25 * Math.sin(x * 1.3 + t * 2);
    for (let y = 0; y < 30; y++) {
      const d = y - edge;
      if (d < -10 || d > 2) {
        continue;
      }
      const k = (d >= 0 ? 1 - d / 2.5 : 1 + d / 10) * streak;
      if (k <= threshold(x, y)) {
        continue;
      }
      let color = teal;
      if (d < -6) {
        color = violet;
      } else if (k > 0.75) {
        color = bright;
      } else if (k > 0.45) {
        color = green;
      }
      canvas.set(x, y, color);
    }
  }
  const far = hex("#33507a");
  fillBelow(
    canvas,
    (x) =>
      ridge(x, 29, [
        [1.5, 11, 0],
        [1, 5, 2],
      ]),
    () => far
  );
  const ground = hex("#a9c2dd");
  const groundShade = hex("#87a5c8");
  const groundLine = (x: number) => ridge(x, 33, [[1, 14, 2]]);
  fillBelow(canvas, groundLine, (x, y, depth) =>
    depth > 3 && threshold(x, y) < 0.3 ? groundShade : ground
  );
  sprite(
    canvas,
    CABIN,
    { r: "#e8eef7", b: "#5b3a2e", w: "#ffd36b", d: "#3a241c" },
    96,
    groundLine(100) - 6
  );
  const smoke = hex("#8fa3c4");
  for (let i = 0; i < 4; i++) {
    const age = wrap(t * 0.4 + i / 4, 1);
    canvas.set(
      102 + Math.sin(age * 6) * 1.2,
      groundLine(100) - 7 - age * 9,
      mix(smoke, hex("#14214a"), age)
    );
  }
  const glow = hex("#e4d9a4");
  for (const [dx, dy] of [
    [97, 1],
    [98, 1],
    [97, 2],
  ] as const) {
    canvas.set(dx, groundLine(100) + dy, glow);
  }
}

const CLOUD = ["..www...", ".wwwwww.", "wwwwwwww", ".ssssss."];

function beach(canvas: Canvas, t: number) {
  sky(canvas, ["#3fa3e0", "#6cc0ec", "#a4dbf4", "#d6effa"], 0, 24);
  const glow = hex("#fde9a0");
  for (let y = 0; y < 16; y++) {
    for (let x = 96; x < 114; x++) {
      if (Math.hypot(x - 104, y - 7) < 7 && threshold(x, y) < 0.5) {
        canvas.set(x, y, glow);
      }
    }
  }
  disc(canvas, 104, 7, 4.5, hex("#fff6c2"));
  const cloud = { w: "#ffffff", s: "#e3f1fa" };
  const drift = (x0: number, speed: number) =>
    Math.round(wrap(x0 + t * speed, BRIEF_SCENE_COLS + 10) - 10);
  sprite(canvas, CLOUD, cloud, drift(22, 1.5), 5);
  sprite(canvas, CLOUD, cloud, drift(60, 1), 10);
  sprite(canvas, CLOUD.slice(1), cloud, drift(82, 1.8), 4);
  sky(canvas, ["#1b6fa8", "#2389bf", "#2ea3cf"], 24, 35);
  const island = hex("#2f7d6a");
  for (let x = 40; x < 54; x++) {
    const h = Math.round(2.2 * Math.sin(((x - 40) / 14) * Math.PI));
    for (let y = 24 - h; y < 24; y++) {
      canvas.set(x, y, island);
    }
  }
  const random = seeded(3 + Math.floor(t * 2));
  const sparkle = hex("#d8f3ff");
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(random() * BRIEF_SCENE_COLS);
    const y = 25 + Math.floor(random() * 7);
    canvas.set(x, y, sparkle);
    canvas.set(x + 1, y, sparkle);
  }
  const foam = hex("#f4fbff");
  const wet = hex("#e2c88f");
  const sand = hex("#f2dcaa");
  const speck = hex("#e6c98e");
  fillBelow(
    canvas,
    (x) =>
      ridge(x, 31 + Math.sin(t * 0.9) * 0.9, [
        [1, 6, t * 0.5],
        [0.5, 3, 1],
      ]),
    (x, y, depth) => {
      if (depth === 0) {
        return foam;
      }
      if (depth === 1) {
        return wet;
      }
      return threshold(x * 3, y * 5) < 0.12 ? speck : sand;
    }
  );
  const trunk = hex("#8b5e3c");
  const ring = hex("#6e4a2f");
  for (let y = 16; y <= 39; y++) {
    const x = 12 + Math.round(((39 - y) / 23) ** 2 * 8);
    const color = y % 3 === 0 ? ring : trunk;
    canvas.set(x, y, color);
    canvas.set(x + 1, y, color);
  }
  const leaf = hex("#2e8b57");
  const leafLight = hex("#46b072");
  for (const [dx, curve, length] of [
    [1, 0.05, 12],
    [-1, 0.05, 11],
    [1, 0.14, 9],
    [-1, 0.14, 9],
    [1, -0.06, 6],
    [-1, -0.06, 6],
  ] as const) {
    for (let i = 1; i <= length; i++) {
      const x = 21 + dx * i;
      const sway = i > length / 2 ? Math.round(Math.sin(t * 1.6 + dx)) : 0;
      const y = 15 + Math.round(i * i * curve) + sway;
      canvas.set(x, y, leafLight);
      if (i < length - 2) {
        canvas.set(x, y + 1, leaf);
      }
      if (i > 2 && i % 2 === 0 && curve > 0) {
        canvas.set(x, y + 2, leaf);
      }
    }
  }
  disc(canvas, 21, 15, 1.5, leaf);
  canvas.set(20, 17, hex("#5a3d24"));
  canvas.set(22, 17, hex("#5a3d24"));
}

function alpineLake(canvas: Canvas, t: number) {
  const shore = 23;
  sky(canvas, ["#8fb1d9", "#c9c3de", "#f2c9b8", "#f9e3c6"], 0, shore);
  disc(canvas, 40, 15, 3.5, hex("#fff1d6"));
  mountains(
    canvas,
    [
      { x: 18, y: 7 },
      { x: 50, y: 4 },
      { x: 86, y: 8 },
      { x: 116, y: 5 },
    ],
    1,
    11,
    { rock: "#7c7fb0", shade: "#676a9c", snow: "#f6f1f4", snowShade: "#d8cfe2" }
  );
  const forest = hex("#2d4f43");
  const forestDark = hex("#223f36");
  for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
    const spike = x % 4 === 1 ? 2 : Number(x % 4 !== 3);
    const top = shore - 2 - spike - Math.round(1.5 * Math.sin(x / 7));
    for (let y = top; y < shore; y++) {
      canvas.set(x, y, y > shore - 2 ? forestDark : forest);
    }
  }
  const water = hex("#3e6f96");
  const shimmer = hex("#e8f1f7");
  const random = seeded(9);
  for (let y = shore; y < BRIEF_SCENE_ROWS; y++) {
    const ripple = (y + Math.floor(t * 2)) % 3 === 0 ? 1 : 0;
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const mirrored = canvas.get(x + ripple, 2 * shore - y - 1);
      canvas.set(x, y, mix(mirrored, water, 0.45 + (y - shore) * 0.015));
    }
    for (let i = 0; i < 3; i++) {
      const speed = 1 + (y % 3);
      const x = wrap(random() * BRIEF_SCENE_COLS + t * speed, BRIEF_SCENE_COLS);
      for (let w = 0; w < 3; w++) {
        canvas.set(x + w, y, mix(shimmer, water, 0.3));
      }
    }
  }
}

const BIRD_UP = ["b...b", ".b.b.", "..b.."];
const BIRD_DOWN = [".....", "bb.bb", "..b.."];

/** Birds that flap; `speed` > 0 flies them across and around again. */
function birds(
  canvas: Canvas,
  t: number,
  list: { x: number; y: number; speed: number }[],
  color: string
) {
  for (const [i, bird] of list.entries()) {
    const up = Math.floor(t * 4 + i) % 2 === 0;
    const x =
      bird.speed > 0
        ? wrap(bird.x + t * bird.speed, BRIEF_SCENE_COLS + 10) - 5
        : bird.x;
    sprite(canvas, up ? BIRD_UP : BIRD_DOWN, { b: color }, x, bird.y);
  }
}

function canyon(canvas: Canvas, t: number) {
  sky(canvas, ["#7ec3e8", "#a6d6ef", "#d2ebf6"], 0, 24);
  const farStrata = ["#e3a06b", "#d98a5a", "#c8714a"].map((color) =>
    mix(hex(color), hex("#d2ebf6"), 0.3)
  );
  fillBelow(
    canvas,
    (x) =>
      15 + (x % 40 < 22 ? 0 : 2) + (x % 40 === 21 || x % 40 === 39 ? 1 : 0),
    (_x, y) => farStrata[Math.floor(y / 2) % farStrata.length] ?? null
  );
  const nearStrata = ["#a8452f", "#b9553a", "#c96a45", "#d98a5a"].map(hex);
  const river = hex("#4f9bc0");
  const riverLight = hex("#8cc7df");
  for (let y = 8; y < BRIEF_SCENE_ROWS; y++) {
    const left = 16 + Math.round((y - 8) * 1.25 + Math.sin(y * 1.9));
    const right = 112 - Math.round((y - 8) * 1.25 + Math.sin(y * 2.3));
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const band = Math.floor((y + (x < 64 ? 0 : 2)) / 3) % nearStrata.length;
      const strata = nearStrata[band];
      if ((x < left || x > right) && strata) {
        canvas.set(x, y, strata);
      } else if (y >= 35) {
        const flow = threshold(x + Math.floor(t * 4), y) < 0.15;
        canvas.set(x, y, flow ? riverLight : river);
      }
    }
  }
  const circling = [0, 2.1, 4.2].map((phase, i) => ({
    x: 64 + Math.cos(t * 0.4 + phase) * (18 + i * 6),
    y: 7 + Math.sin(t * 0.4 + phase) * 3,
    speed: 0,
  }));
  birds(canvas, t, circling, "#3a2a2a");
}

const CYPRESS = [".c.", ".c.", "ccc", "ccc", "ccc", "ccc", "ccc", ".t."];

function lavender(canvas: Canvas, t: number) {
  const horizon = 26;
  sky(canvas, ["#8cc8ec", "#b5dcf2", "#ddeff8", "#f5f0e6"], 0, horizon);
  disc(canvas, 30, 7, 4, hex("#fff4c4"));
  sprite(
    canvas,
    CLOUD,
    { w: "#ffffff", s: "#e8f3f9" },
    Math.round(wrap(78 + t * 1.2, BRIEF_SCENE_COLS + 10) - 10),
    6
  );
  const farHill = hex("#9cc184");
  fillBelow(
    canvas,
    (x) =>
      ridge(x, 19, [
        [2, 15, 0],
        [1, 6, 1],
      ]),
    () => farHill
  );
  const midHill = hex("#7fae67");
  const midLine = (x: number) => ridge(x, 23, [[2, 11, 2]]);
  fillBelow(canvas, midLine, () => midHill);
  const palette = { c: "#2f5a3a", t: "#4a3628" };
  for (const x of [70, 74, 100, 22]) {
    sprite(canvas, CYPRESS, palette, x, midLine(x + 1) - 7);
  }
  const haze = hex("#f5f0e6");
  const purple = hex("#8e6fc9");
  const purpleLight = hex("#a58ae0");
  const green = hex("#5f8f4e");
  for (let y = horizon; y < BRIEF_SCENE_ROWS; y++) {
    const distance = 1 - (y - horizon) / (BRIEF_SCENE_ROWS - horizon);
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const u = (x - 64) / (y - horizon + 2);
      const row = Math.floor(u * 2.2 + 100);
      let color = green;
      if (row % 2 === 0) {
        const wind = threshold(x + Math.floor(t * 3), y) < 0.3;
        color = wind ? purpleLight : purple;
      }
      canvas.set(x, y, mix(color, haze, distance * 0.35));
    }
  }
  const wing = hex("#fff6d8");
  for (const [i, home] of [
    { x: 40, y: 30 },
    { x: 92, y: 33 },
  ].entries()) {
    const x = home.x + Math.sin(t * 0.7 + i * 2) * 8;
    const y = home.y + Math.sin(t * 1.9 + i) * 2;
    canvas.set(x, y, wing);
    if (Math.floor(t * 6 + i) % 2 === 0) {
      canvas.set(x + 1, y, wing);
    }
  }
}

/** A stable 0..1 value per cell, for textures that must not shimmer. */
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263) + seed;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

interface Blob {
  x: number;
  y: number;
  r: number;
}

/** Round tree crowns in a row, each with a slightly different size. */
function crowns(seed: number, base: number, step: number, size: number) {
  const random = seeded(seed);
  const list: Blob[] = [];
  for (let x = -size; x < BRIEF_SCENE_COLS + size; x += step) {
    const r = size * (0.7 + random() * 0.6);
    list.push({ x: x + random() * step * 0.5, y: base + random() * 3, r });
  }
  return list;
}

function inBlobs(x: number, y: number, list: Blob[]) {
  return list.some((blob) => Math.hypot(x - blob.x, y - blob.y) <= blob.r);
}

const PARROT = [".rr.", "rrry", ".rb.", ".rb.", "..r."];
const FERN = ["f.....f", ".f.f.f.", "..fff..", "f.fff.f", ".fffff.", "...f..."];

function rainforest(canvas: Canvas, t: number) {
  sky(canvas, ["#cde8d6", "#e0f1e5", "#f0f8f1"], 0, 24);
  const layers = [
    { list: crowns(12, 16, 9, 7), color: "#a9d1b4" },
    { list: crowns(13, 22, 8, 7), color: "#6fae86" },
  ];
  for (const layer of layers) {
    const color = hex(layer.color);
    for (let y = 0; y < BRIEF_SCENE_ROWS; y++) {
      for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
        const below = layer.list.some(
          (blob) => Math.abs(x - blob.x) <= blob.r && y >= blob.y
        );
        if (below || inBlobs(x, y, layer.list)) {
          canvas.set(x, y, color);
        }
      }
    }
  }
  const cliff = hex("#5f6f5c");
  const cliffDark = hex("#4c5a4a");
  for (let y = 6; y < 34; y++) {
    for (let x = 62; x < 84; x++) {
      const edge = Math.abs(x - 73) - (y - 6) * 0.25;
      if (edge < 8) {
        canvas.set(x, y, hash(x, y, 4) < 0.25 ? cliffDark : cliff);
      }
    }
  }
  const fall = hex("#eaf7ff");
  const fallShade = hex("#b9dff0");
  for (let y = 9; y < 34; y++) {
    for (let x = 70; x < 76; x++) {
      const stripe = wrap(x + y - Math.floor(t * 12), 3) === 0;
      canvas.set(x, y, stripe ? fallShade : fall);
    }
  }
  const pool = hex("#5fa7b8");
  const foam = hex("#f2fbff");
  for (let y = 33; y < BRIEF_SCENE_ROWS; y++) {
    for (let x = 52; x < 96; x++) {
      if (Math.abs(x - 73) < 22 - (y - 33) * 0.5) {
        const near = Math.abs(x - 73) < 6 && y < 36;
        const splash = hash(x, y, 8 + Math.floor(t * 6)) < 0.6;
        canvas.set(x, y, near && splash ? foam : pool);
      }
    }
  }
  const front = crowns(14, 30, 10, 8).filter(
    (blob) => blob.x < 56 || blob.x > 92
  );
  const dark = hex("#2f6f4a");
  const light = hex("#3f8a5c");
  for (let y = 0; y < BRIEF_SCENE_ROWS; y++) {
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const below = front.some(
        (blob) => Math.abs(x - blob.x) <= blob.r && y >= blob.y
      );
      if (below || inBlobs(x, y, front)) {
        canvas.set(x, y, hash(x, y, 2) < 0.2 ? light : dark);
      }
    }
  }
  const vine = hex("#2a5e40");
  const leaf = hex("#4c9a68");
  for (const [x, length] of [
    [6, 9],
    [17, 13],
    [31, 7],
    [101, 11],
    [114, 15],
    [123, 8],
  ] as const) {
    for (let y = 0; y < length; y++) {
      const swing = Math.round(Math.sin(t * 0.9 + x) * (y / length) * 1.2);
      canvas.set(x + swing, y, vine);
      if (y % 3 === 1) {
        canvas.set(x + swing + (y % 2 === 0 ? 1 : -1), y, leaf);
      }
    }
  }
  sprite(canvas, PARROT, { r: "#e2483d", y: "#f6c344", b: "#3b6fd8" }, 112, 15);
  for (const x of [2, 20, 40, 98, 118]) {
    sprite(canvas, FERN, { f: "#24563a" }, x, 34);
  }
}

function cityAtNight(canvas: Canvas, t: number) {
  sky(canvas, ["#0d1030", "#1b1d4a", "#3a2d63", "#6a3f72"], 0, 34);
  const random = seeded(17);
  const star = hex("#e6e8ff");
  for (let i = 0; i < 40; i++) {
    canvas.set(
      Math.floor(random() * BRIEF_SCENE_COLS),
      Math.floor(random() * 14),
      star
    );
  }
  disc(canvas, 18, 8, 4, hex("#f4efd2"));
  disc(canvas, 20, 7, 3, hex("#1b1d4a"));
  const water = 34;
  const lights = ["#ffd36b", "#ffe9a8", "#9fd3ff"].map(hex);
  const reflections: { x: number; color: Rgb }[] = [];
  const skyline = (
    seed: number,
    from: number,
    to: number,
    body: Rgb,
    lit: number,
    dim: boolean
  ) => {
    const rand = seeded(seed);
    let x = -2;
    while (x < BRIEF_SCENE_COLS) {
      const width = 4 + Math.floor(rand() * 6);
      const top = from + Math.floor(rand() * (to - from));
      for (let bx = x; bx < x + width; bx++) {
        for (let y = top; y < water; y++) {
          canvas.set(bx, y, body);
        }
      }
      if (rand() < 0.25) {
        for (let y = top - 3; y < top; y++) {
          canvas.set(x + Math.floor(width / 2), y, body);
        }
        const blink = Math.floor(t * 1.5 + x) % 2 === 0;
        canvas.set(
          x + Math.floor(width / 2),
          top - 4,
          blink ? hex("#ff5d73") : body
        );
      }
      for (let wy = top + 2; wy < water - 1; wy += 2) {
        for (let wx = x + 1; wx < x + width - 1; wx += 2) {
          const moment = Math.floor(t / 2);
          if (rand() < lit) {
            const color = dim
              ? mix(body, hex("#ffd36b"), 0.35)
              : (lights[Math.floor(rand() * lights.length)] ?? body);
            const off = hash(wx, wy, moment) < 0.05;
            canvas.set(wx, wy, off ? body : color);
            if (!dim && rand() < 0.5) {
              reflections.push({ x: wx, color });
            }
          } else if (!dim && hash(wx, wy, moment + 7) < 0.02) {
            canvas.set(wx, wy, lights[0] ?? body);
          }
        }
      }
      x += width + (rand() < 0.3 ? 1 : 0);
    }
  };
  skyline(21, 10, 24, hex("#2a2b5a"), 0.15, true);
  skyline(22, 16, 30, hex("#15163a"), 0.35, false);
  sky(canvas, ["#151741", "#0e1030", "#0a0b26"], water, BRIEF_SCENE_ROWS);
  const ripple = seeded(23);
  for (const { x, color } of reflections) {
    const y = water + 1 + Math.floor(ripple() * 5);
    const shift = Math.round(Math.sin(t * 2.5 + y + x) * 0.7);
    const faded = mix(color, hex("#0e1030"), 0.35);
    canvas.set(x + shift, y, faded);
    canvas.set(x + shift + 1, y, faded);
  }
  const plane = wrap(t * 4, BRIEF_SCENE_COLS + 20) - 10;
  canvas.set(plane, 5, hex("#e6e8ff"));
  if (Math.floor(t * 2) % 2 === 0) {
    canvas.set(plane - 1, 5, hex("#ff5d73"));
  }
}

function autumnWoods(canvas: Canvas, t: number) {
  sky(canvas, ["#f2cf9f", "#f6dfbd", "#fbecd6"], 0, 31);
  disc(canvas, 64, 20, 6, hex("#fff2d4"));
  const haze = hex("#fbecd6");
  const leafColors = ["#c9542f", "#e07b39", "#f0a04b", "#f6c35b"].map(hex);
  const far = crowns(31, 20, 7, 6);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      const below = far.some(
        (blob) => Math.abs(x - blob.x) <= blob.r * 0.9 && y >= blob.y
      );
      if (below || inBlobs(x, y, far)) {
        const color =
          leafColors[Math.floor(hash(x, y, 31) * leafColors.length)];
        if (color) {
          canvas.set(x, y, mix(color, haze, 0.55));
        }
      }
    }
  }
  const ground = hex("#c9773a");
  const groundLight = hex("#dd9446");
  const path = hex("#e3bf8a");
  for (let y = 31; y < BRIEF_SCENE_ROWS; y++) {
    const half = 2 + (y - 31) * 1.6;
    const center = 64 + Math.round(Math.sin((y - 31) / 3) * 3);
    for (let x = 0; x < BRIEF_SCENE_COLS; x++) {
      if (Math.abs(x - center) < half) {
        canvas.set(x, y, path);
      } else {
        canvas.set(x, y, hash(x, y, 5) < 0.3 ? groundLight : ground);
      }
    }
  }
  const trunk = hex("#4e3326");
  const trees = [
    { x: 8, r: 11 },
    { x: 30, r: 9 },
    { x: 46, r: 7 },
    { x: 84, r: 7 },
    { x: 100, r: 10 },
    { x: 121, r: 11 },
  ];
  for (const tree of trees) {
    const width = tree.r > 9 ? 3 : 2;
    for (let y = 8; y < 33 + Math.floor(tree.r / 4); y++) {
      for (let w = 0; w < width; w++) {
        canvas.set(tree.x + w, y, trunk);
      }
    }
  }
  for (const tree of trees) {
    const crown = [
      { x: tree.x, y: 7, r: tree.r },
      { x: tree.x - tree.r * 0.6, y: 11, r: tree.r * 0.7 },
      { x: tree.x + tree.r * 0.6, y: 11, r: tree.r * 0.7 },
    ];
    for (let y = 0; y < 22; y++) {
      for (let x = tree.x - tree.r * 2; x < tree.x + tree.r * 2; x++) {
        if (inBlobs(x, y, crown)) {
          const color =
            leafColors[Math.floor(hash(x, y, tree.x) * leafColors.length)];
          if (color) {
            canvas.set(x, y, color);
          }
        }
      }
    }
  }
  const random = seeded(37);
  for (let i = 0; i < 30; i++) {
    const color = leafColors[Math.floor(random() * leafColors.length)];
    const x0 = random() * BRIEF_SCENE_COLS;
    const y0 = random() * BRIEF_SCENE_ROWS;
    const speed = 1.5 + random() * 2;
    if (color) {
      canvas.set(
        wrap(x0 + t * 1.2 + Math.sin(t * 1.5 + i) * 2, BRIEF_SCENE_COLS),
        wrap(y0 + t * speed, BRIEF_SCENE_ROWS),
        color
      );
    }
  }
}

export const BRIEF_SCENES = [
  { name: "Desert at dusk", draw: desert },
  { name: "Snowy peaks", draw: snowyPeaks },
  { name: "Northern lights", draw: northernLights },
  { name: "Beach", draw: beach },
  { name: "Alpine lake", draw: alpineLake },
  { name: "Canyon", draw: canyon },
  { name: "Lavender fields", draw: lavender },
  { name: "Rainforest", draw: rainforest },
  { name: "City at night", draw: cityAtNight },
  { name: "Autumn woods", draw: autumnWoods },
] as const;

/** One place per calendar day, in order, so the view changes every brief. */
export function briefSceneIndex(date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return day % BRIEF_SCENES.length;
}

/** One frame of a scene; `seconds` drives clouds, snow, water and lights. */
export function renderBriefScene(index: number, seconds = 0) {
  const canvas = createCanvas();
  const scene = BRIEF_SCENES[index % BRIEF_SCENES.length] ?? BRIEF_SCENES[0];
  scene.draw(canvas, seconds);
  return canvas.data;
}
