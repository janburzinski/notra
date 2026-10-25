// Halloween hero: a pixel-art fog lake in the spirit of boat.dev:
// a single-hue ramp, Bayer dithering, horizontal streaks, mirrored shores and
// jack-o'-lanterns floating where boat.dev floats its boats.

export const PIXEL = 3;

export interface ScenePalette {
  ramp: string[];
  skyTop: number;
  skyHorizon: number;
  moonGlow: number;
  farHill: number;
  stars: boolean;
  // Halo colour around the jack-o'-lanterns
  glow: string;
}

// Accent slots live above the ramp in the index buffer.
const A_ORANGE_DARK = 20;
const A_ORANGE = 21;
const A_ORANGE_LIGHT = 22;
const A_FACE = 23;
const A_STEM = 24;
const A_REFLECT = 25;
const A_GLOW = 26;

// Mask ids: 1 far hills, 2 shores, WINDOW + n lit window n
const WINDOW = 3;

export interface FloatingPumpkin {
  // x and waterline as fractions of the hero box
  fx: number;
  fy: number;
  scale: 0 | 1 | 2;
  // Engine named in the "cited by" tag above it
  cited?: string;
  // Scene time it was placed, so it can fade in
  born: number;
}

export interface SceneInput {
  pumpkins: FloatingPumpkin[];
  // Splashes where a pumpkin landed and puffs where one was removed,
  // in buffer pixels, stamped with scene time
  ripples: { x: number; y: number; t: number }[];
  poofs: { x: number; y: number; t: number }[];
}

const RIPPLE_LIFE = 1.6;
const METEOR_LIFE = 0.8;
const FADE_IN = 0.35;
const POOF_LIFE = 0.5;

const ACCENTS: Record<number, string> = {
  [A_ORANGE_DARK]: "#B4410C",
  [A_ORANGE]: "#F2711C",
  [A_ORANGE_LIGHT]: "#FF9A3D",
  [A_FACE]: "#FFD45C",
  [A_STEM]: "#3F6212",
  [A_REFLECT]: "#C2541A",
};

// Nebel: a lavender fog lake, light and dark to follow the site theme.
export const PALETTES = {
  light: {
    ramp: [
      "#24194A",
      "#4A3B86",
      "#8676C2",
      "#B9ABE6",
      "#D6CCF5",
      "#ECE7FC",
      "#FFFFFF",
    ],
    skyTop: 0.62,
    skyHorizon: 1,
    moonGlow: 0.08,
    farHill: 2,
    stars: false,
    glow: "#FBD3B4",
  },
  dark: {
    ramp: [
      "#0B0717",
      "#1A1330",
      "#2A2140",
      "#3B2F5C",
      "#55467F",
      "#8576B8",
      "#E9E2FF",
    ],
    skyTop: 0.2,
    skyHorizon: 0.62,
    moonGlow: 0.35,
    farHill: 1,
    stars: true,
    glow: "#5A2E33",
  },
} satisfies Record<string, ScenePalette>;

// '.' transparent, d rib shadow, O body, L highlight, y face, g stem
const PUMPKIN_M = [
  "......gg.....",
  ".....gg......",
  "..dOOdOdOOd..",
  ".dOLOdOdOLOd.",
  "dOyyOdOdOyyOd",
  "dOLyOdOdOyLOd",
  "dOOOOdydOOOOd",
  "dOyOyyyyyOyOd",
  ".dOyyOyOyyOd.",
  "..ddOOOOOdd..",
];

const PUMPKIN_S = [
  "....g....",
  "..dOdOd..",
  ".dyOdOyd.",
  "dOOOdOOOd",
  "dOyyyyyOd",
  ".dOyOyOd.",
  "..ddddd..",
];

// w body, k eyes, ':' half-transparent body
const GHOST = [
  "...www...",
  "..wwwww..",
  ".wwwwwww.",
  ".wkwwwkw.",
  ".wkwwwkw.",
  ".wwwwwww.",
  ".wwwkwww.",
  ".wwwwwww.",
  ".:w:w:w:.",
  ".:.:.:.:.",
];

const BAT_UP = ["k.....k", "kk.k.kk", "..kkk.."];
const BAT_DOWN = ["...k...", ".kkkkk.", "k..k..k"];

// Pumpkins floating when the page loads
export const PUMPKINS: readonly Omit<FloatingPumpkin, "born">[] = [
  { fx: 0.07, fy: 0.72, scale: 2 },
  { fx: 0.04, fy: 0.62, scale: 1 },
  { fx: 0.21, fy: 0.565, scale: 0 },
  { fx: 0.33, fy: 0.575, scale: 1 },
  { fx: 0.45, fy: 0.555, scale: 0 },
  { fx: 0.57, fy: 0.57, scale: 0 },
  { fx: 0.69, fy: 0.58, scale: 1 },
  { fx: 0.8, fy: 0.56, scale: 0 },
  { fx: 0.925, fy: 0.74, scale: 2, cited: "ChatGPT" },
  { fx: 0.965, fy: 0.62, scale: 0 },
];

export const GHOST_AT = { fx: 0.07, fy: 0.95 } as const;
const HORIZON = 0.535;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (value) => value / 16
);

function hash(a: number, b = 0) {
  let h = Math.imul(a, 374_761_393) + Math.imul(b, 668_265_263);
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_295;
}

interface Streak {
  y: number;
  x: number;
  len: number;
  speed: number;
  delta: number;
}

export interface Layout {
  w: number;
  h: number;
  horizon: number;
  // 0 none, 1 far hill, 2 near silhouette, 3 lit window
  mask: Uint8Array;
  skyStreaks: Streak[];
  lakeStreaks: Streak[];
  stars: { x: number; y: number }[];
  moon: { x: number; y: number; r: number };
}

function line(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: number
) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      mask[y * w + x] = value;
    }
    if (x === tx && y === ty) {
      return;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function rect(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  value: number
) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(h, y0 + rh); y += 1) {
    for (
      let x = Math.max(0, Math.round(x0));
      x < Math.min(w, x0 + rw);
      x += 1
    ) {
      mask[y * w + x] = value;
    }
  }
}

function deadTree(
  mask: Uint8Array,
  w: number,
  h: number,
  x: number,
  base: number,
  height: number,
  seed: number
) {
  rect(mask, w, h, x, base - height, 2, height, 2);
  const branch = (
    bx: number,
    by: number,
    len: number,
    dir: number,
    d: number
  ) => {
    if (d > 3 || len < 2) {
      return;
    }
    const ex = bx + dir * len * 0.8;
    const ey = by - len * (0.55 + hash(seed, d * 7 + bx) * 0.4);
    line(mask, w, h, bx, by, ex, ey, 2);
    branch(ex, ey, len * 0.6, dir, d + 1);
    branch(ex, ey, len * 0.45, -dir, d + 1);
  };
  branch(x, base - height * 0.55, height * 0.45, -1, 0);
  branch(x + 1, base - height * 0.7, height * 0.4, 1, 0);
  branch(x, base - height, height * 0.3, 1, 1);
}

function hauntedHouse(
  mask: Uint8Array,
  w: number,
  h: number,
  x: number,
  base: number
) {
  rect(mask, w, h, x, base - 18, 28, 18, 2);
  for (let i = 0; i < 10; i += 1) {
    rect(mask, w, h, x - 1 + i, base - 19 - i, 30 - i * 2, 1, 2);
  }
  rect(mask, w, h, x - 9, base - 34, 10, 34, 2);
  for (let i = 0; i < 12; i += 1) {
    const half = Math.max(0, 5 - Math.floor(i / 2));
    rect(mask, w, h, x - 4 - half, base - 35 - i, half * 2 + 1, 1, 2);
  }
  rect(mask, w, h, x + 20, base - 31, 3, 6, 2);
  const windows = [
    [x - 6, base - 27],
    [x + 5, base - 13],
    [x + 12, base - 13],
    [x + 20, base - 13],
    [x + 12, base - 24],
  ];
  for (const [i, [wx, wy]] of windows.entries()) {
    rect(mask, w, h, wx ?? 0, wy ?? 0, 3, 4, WINDOW + i);
  }
}

function gravestone(
  mask: Uint8Array,
  w: number,
  h: number,
  x: number,
  base: number,
  cross: boolean
) {
  if (cross) {
    rect(mask, w, h, x + 2, base - 9, 2, 9, 2);
    rect(mask, w, h, x, base - 7, 6, 2, 2);
    return;
  }
  rect(mask, w, h, x, base - 6, 6, 6, 2);
  rect(mask, w, h, x + 1, base - 7, 4, 1, 2);
}

export function buildLayout(w: number, h: number): Layout {
  const mask = new Uint8Array(w * h);
  const horizon = Math.round(h * HORIZON);

  for (let x = 0; x < w; x += 1) {
    const top = Math.round(
      horizon -
        3 -
        5 * (0.5 + 0.5 * Math.sin(x * 0.021 + 1.3)) -
        2.5 * Math.sin(x * 0.067 + 0.4)
    );
    for (let y = Math.max(0, top); y < horizon; y += 1) {
      mask[y * w + x] = 1;
    }
  }

  const shore = (from: number, to: number, peak: number, rise: number) => {
    for (let x = Math.max(0, from); x < Math.min(w, to); x += 1) {
      const t = (x - from) / (to - from);
      const bump = Math.sin(t * Math.PI) ** 0.6;
      const top = Math.round(horizon - rise * bump - (peak === x ? 0 : 0));
      for (let y = Math.max(0, top); y < horizon; y += 1) {
        mask[y * w + x] = 2;
      }
    }
  };

  const left = Math.round(w * 0.22);
  shore(-10, left, 0, 9);
  deadTree(mask, w, h, Math.round(w * 0.045), horizon - 6, 38, 3);
  for (const [i, gx] of [0.1, 0.135, 0.165, 0.19].entries()) {
    gravestone(
      mask,
      w,
      h,
      Math.round(w * gx),
      horizon - 6 + (i % 2),
      i % 2 === 1
    );
  }

  const right = Math.round(w * 0.78);
  shore(right, w + 10, 0, 11);
  if (w > 220) {
    hauntedHouse(mask, w, h, Math.round(w * 0.86), horizon - 8);
  }
  deadTree(mask, w, h, Math.round(w * 0.975), horizon - 7, 30, 9);

  if (w > 220) {
    shore(Math.round(w * 0.55), Math.round(w * 0.63), 0, 4);
    deadTree(mask, w, h, Math.round(w * 0.585), horizon - 3, 16, 5);
  }

  const skyStreaks: Streak[] = [];
  for (let i = 0; i < Math.round(w / 9); i += 1) {
    skyStreaks.push({
      y: Math.round(h * 0.06 + hash(i, 1) * (horizon - h * 0.06 - 4)),
      x: hash(i, 2) * w,
      len: 6 + hash(i, 3) * 46,
      speed: 0.6 + hash(i, 4) * 2.2,
      delta: hash(i, 5) < 0.8 ? 1 : -1,
    });
  }

  const lakeStreaks: Streak[] = [];
  for (let i = 0; i < Math.round(w / 2.2); i += 1) {
    lakeStreaks.push({
      y: horizon + 1 + Math.round(hash(i, 11) * (h - horizon - 1)),
      x: hash(i, 12) * w,
      len: 3 + hash(i, 13) * 22,
      speed: -(0.4 + hash(i, 14) * 1.8),
      delta: hash(i, 15) < 0.55 ? -1 : 1,
    });
  }

  const stars: { x: number; y: number }[] = [];
  for (let i = 0; i < Math.round(w / 6); i += 1) {
    stars.push({
      x: Math.round(hash(i, 21) * w),
      y: Math.round(hash(i, 22) * horizon * 0.55),
    });
  }

  return {
    w,
    h,
    horizon,
    mask,
    skyStreaks,
    lakeStreaks,
    stars,
    moon: {
      x: Math.round(w * 0.84),
      y: Math.round(h * 0.19),
      r: Math.max(7, Math.round(Math.min(w, h) * 0.045)),
    },
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function paletteTable(palette: ScenePalette) {
  const table: [number, number, number][] = [];
  palette.ramp.forEach((color, index) => {
    table[index] = hexToRgb(color);
  });
  for (const [slot, color] of Object.entries(ACCENTS)) {
    table[Number(slot)] = hexToRgb(color);
  }
  table[A_GLOW] = hexToRgb(palette.glow);
  return table;
}

const SPRITE_INDEX: Record<string, number> = {
  d: A_ORANGE_DARK,
  O: A_ORANGE,
  L: A_ORANGE_LIGHT,
  y: A_FACE,
  g: A_STEM,
};

function stamp(
  buf: Uint8Array,
  w: number,
  h: number,
  sprite: readonly string[],
  x0: number,
  y0: number,
  scale: number,
  pick: (char: string, x: number, y: number) => number | undefined
) {
  sprite.forEach((row, sy) => {
    for (let sx = 0; sx < row.length; sx += 1) {
      const char = row[sx] ?? ".";
      if (char === ".") {
        continue;
      }
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = x0 + sx * scale + dx;
          const y = y0 + sy * scale + dy;
          if (x < 0 || x >= w || y < 0 || y >= h) {
            continue;
          }
          const value = pick(char, x, y);
          if (value !== undefined) {
            buf[y * w + x] = value;
          }
        }
      }
    }
  });
}

export function renderFrame(
  buf: Uint8Array,
  layout: Layout,
  palette: ScenePalette,
  t: number,
  input: SceneInput
) {
  const { w, h, horizon, mask, moon } = layout;
  const top = palette.ramp.length - 1;

  // Sky
  for (let y = 0; y < horizon; y += 1) {
    const g = y / horizon;
    const base =
      palette.skyTop + (palette.skyHorizon - palette.skyTop) * g ** 1.3;
    for (let x = 0; x < w; x += 1) {
      const dx = (x - moon.x) / (moon.r * 7);
      const dy = (y - moon.y) / (moon.r * 5);
      const glow =
        w > 220 ? Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) ** 2 : 0;
      const v = Math.min(1, base + glow * palette.moonGlow);
      const b = BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
      buf[y * w + x] = Math.min(top, Math.max(0, Math.floor(v * top + b)));
    }
  }

  for (const s of layout.skyStreaks) {
    const start = Math.floor((s.x + t * s.speed) % (w + s.len)) - s.len;
    for (let i = 0; i < s.len; i += 1) {
      const x = start + i;
      if (x < 0 || x >= w) {
        continue;
      }
      const edge = i < 2 || i > s.len - 3;
      if (edge && ((x + s.y) & 1) === 1) {
        continue;
      }
      const at = s.y * w + x;
      buf[at] = Math.min(top, Math.max(0, (buf[at] ?? 0) + s.delta));
    }
  }

  if (palette.stars) {
    layout.stars.forEach((star, i) => {
      if (hash(i, Math.floor(t * 1.5 + i)) < 0.2) {
        return;
      }
      const at = star.y * w + star.x;
      if ((buf[at] ?? 0) < top - 2) {
        buf[at] = hash(i, 40) < 0.3 ? top : top - 1;
      }
    });
  }

  // A shooting star now and then at night
  const meteors: { x: number; y: number; t: number }[] = [];
  if (palette.stars) {
    const round = Math.floor(t / 9);
    meteors.push({
      x: hash(round, 60) * w * 0.7,
      y: hash(round, 61) * horizon * 0.35,
      t: round * 9 + 3,
    });
  }
  const meteorColor = palette.stars ? top : 1;
  for (const meteor of meteors) {
    const age = t - meteor.t;
    if (age < 0 || age > METEOR_LIFE) {
      continue;
    }
    const head = age * 90;
    const tail = 26 * (1 - age / METEOR_LIFE);
    for (let i = 0; i < tail; i += 1) {
      const x = Math.round(meteor.x + (head - i) * 0.94);
      const y = Math.round(meteor.y + (head - i) * 0.34);
      if (x < 0 || x >= w || y < 0 || y >= horizon) {
        continue;
      }
      if (i > tail * 0.4 && ((x + y) & 1) === 1) {
        continue;
      }
      buf[y * w + x] = meteorColor;
    }
  }

  // Narrow screens put the subhead where the moon would be.
  const showMoon = w > 220;
  const moonR = showMoon ? moon.r : -1;
  for (let y = moon.y - moonR; y <= moon.y + moonR; y += 1) {
    for (let x = moon.x - moon.r; x <= moon.x + moon.r; x += 1) {
      const d = (x - moon.x) ** 2 + (y - moon.y) ** 2;
      if (d > moon.r * moon.r || x < 0 || y < 0 || x >= w || y >= h) {
        continue;
      }
      const cx = (x - moon.x) / moon.r;
      const cy = (y - moon.y) / moon.r;
      const crater =
        (cx + 0.3) ** 2 + (cy + 0.25) ** 2 < 0.05 ||
        (cx - 0.35) ** 2 + (cy - 0.3) ** 2 < 0.03 ||
        (cx + 0.05) ** 2 + (cy - 0.45) ** 2 < 0.015;
      buf[y * w + x] = crater ? top - 1 : top;
    }
  }

  // Bats cross the moon
  const bats = showMoon ? 6 : 0;
  for (let i = 0; i < bats; i += 1) {
    const angle = t * (0.25 + hash(i, 50) * 0.3) + hash(i, 51) * Math.PI * 2;
    const radius = moon.r * (1.4 + hash(i, 52) * 0.9);
    const x = moon.x + Math.cos(angle) * radius * 1.5 - 3;
    const y = moon.y + Math.sin(angle) * radius * 0.8 + Math.sin(t * 2 + i) * 2;
    const frame = Math.floor(t * 7 + i) % 2 === 0 ? BAT_UP : BAT_DOWN;
    stamp(buf, w, h, frame, Math.round(x), Math.round(y), 1, () => 0);
  }

  // Silhouettes
  for (let i = 0; i < horizon * w; i += 1) {
    const m = mask[i] ?? 0;
    if (m === 1) {
      buf[i] = palette.farHill;
    } else if (m === 2) {
      buf[i] = 0;
    } else if (m >= WINDOW) {
      const off = hash(m, Math.floor(t / 2.5)) < 0.18;
      if (off) {
        buf[i] = 0;
      } else {
        buf[i] = hash(i, Math.floor(t * 3)) < 0.05 ? A_ORANGE : A_FACE;
      }
    }
  }

  // Lake: mirrored, darker, rippled
  for (let y = horizon; y < h; y += 1) {
    const d = y - horizon;
    const my = Math.max(0, horizon - 1 - d);
    const amp = Math.min(2.5, 0.4 + d * 0.035);
    const shift = Math.round(Math.sin(d * 0.6 - t * 1.8) * amp);
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(w - 1, Math.max(0, x + shift));
      const src = buf[my * w + sx] ?? 0;
      let out: number;
      if (src >= 20) {
        out = A_REFLECT;
      } else {
        out = Math.max(0, src - 1);
      }
      if ((d & 1) === 1 && src >= 20) {
        out = palette.farHill;
      }
      buf[y * w + x] = out;
    }
  }

  for (const s of layout.lakeStreaks) {
    const start = Math.floor((((s.x + t * s.speed) % w) + w) % w);
    for (let i = 0; i < s.len; i += 1) {
      const x = (start + i) % w;
      const at = s.y * w + x;
      const value = buf[at] ?? 0;
      if (value >= 20) {
        continue;
      }
      buf[at] = Math.min(top - 1, Math.max(0, value + s.delta));
    }
  }

  // Moon glitter on the water
  for (let y = horizon + 1; y < h; y += 1) {
    const d = y - horizon;
    const spread = 2 + d * 0.18;
    for (let k = 0; k < 3; k += 1) {
      if (hash(y * 7 + k, Math.floor(t * 4)) < 0.6) {
        continue;
      }
      const x = Math.round(
        moon.x + (hash(y, k + Math.floor(t * 4)) - 0.5) * 2 * spread
      );
      const len = 1 + Math.floor(hash(y, k + 99) * 4);
      for (let i = 0; i < len; i += 1) {
        const at = y * w + x + i;
        if (
          x + i >= 0 &&
          x + i < w &&
          (buf[at] ?? 0) > 1 &&
          (buf[at] ?? 0) < 20
        ) {
          buf[at] = top - (d > 30 ? 1 : 0);
        }
      }
    }
  }

  // Splashes where pumpkins landed
  for (const ripple of input.ripples) {
    const age = t - ripple.t;
    if (age < 0 || age > RIPPLE_LIFE) {
      continue;
    }
    const fade = age / RIPPLE_LIFE;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = age * 14 - ring * 5;
      if (radius < 1) {
        continue;
      }
      const steps = Math.ceil(radius * 6);
      for (let k = 0; k < steps; k += 1) {
        const angle = (k / steps) * Math.PI * 2;
        const x = Math.round(ripple.x + Math.cos(angle) * radius);
        const y = Math.round(ripple.y + Math.sin(angle) * radius * 0.32);
        if (x < 0 || x >= w || y <= horizon || y >= h) {
          continue;
        }
        if (hash(x * 31 + y, k) < fade) {
          continue;
        }
        const at = y * w + x;
        const value = buf[at] ?? 0;
        if (value < 20) {
          buf[at] = Math.min(top, value + 3 - ring);
        }
      }
    }
  }

  // Fog lying on the horizon
  for (let y = horizon - 7; y < horizon + 10; y += 1) {
    const density = 1 - Math.abs(y - horizon) / 10;
    for (let x = 0; x < w; x += 1) {
      const drift = 0.5 + 0.5 * Math.sin(x * 0.045 + t * 0.35 + y * 0.3);
      const b = BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
      const at = y * w + x;
      const value = buf[at] ?? 0;
      if (value < 20 && b < density * drift * 0.7) {
        buf[at] = Math.min(top - 1, value + 1);
      }
    }
  }

  // Pumpkins and their glow
  for (const [i, p] of input.pumpkins.entries()) {
    const box = pumpkinBox(p, w, h);
    const cx = box.x0 + box.sw / 2;
    const cy = box.waterline - box.sh * 0.45;
    const radius = Math.max(box.sw, box.sh) * 1.05;
    const pulse = (0.85 + 0.15 * Math.sin(t * 2.3 + i)) * settled(t, p.born);
    for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
      for (
        let x = Math.floor(cx - radius * 1.4);
        x <= cx + radius * 1.4;
        x += 1
      ) {
        if (x < 0 || y < 0 || x >= w || y >= h) {
          continue;
        }
        const d = Math.hypot((x - cx) / 1.4, y - cy) / radius;
        const b = BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
        const at = y * w + x;
        if (
          d < 1 &&
          b < (1 - d) * pulse &&
          (buf[at] ?? 0) < 20 &&
          mask[at] !== 2
        ) {
          buf[at] = A_GLOW;
        }
      }
    }
  }

  for (const [i, p] of input.pumpkins.entries()) {
    const { sprite, scale, x0, sw, sh } = pumpkinBox(p, w, h);
    const bob = Math.sin(t * 1.7 + i * 1.9) > 0.35 ? 1 : 0;
    const waterline = Math.round(p.fy * h) + bob;
    const flicker = hash(i, Math.floor(t * 9)) < 0.1;
    // A new pumpkin dissolves in through the dither instead of popping
    const fade = settled(t, p.born);

    stamp(buf, w, h, sprite, x0, waterline - sh, scale, (char, x, y) => {
      if (fade < 1 && (BAYER[(y & 3) * 4 + (x & 3)] ?? 0) >= fade) {
        return undefined;
      }
      if (char === "y" && flicker) {
        return A_ORANGE_LIGHT;
      }
      return SPRITE_INDEX[char];
    });

    const reflect = Math.ceil(sh * 0.7);
    for (let r = 1; r <= reflect; r += 1) {
      if (r % 2 === 0) {
        continue;
      }
      const y = waterline + r;
      const row =
        sprite[Math.min(sprite.length - 1, Math.floor((sh - r) / scale))] ?? "";
      for (let sx = 0; sx < sw; sx += 1) {
        const char = row[Math.floor(sx / scale)] ?? ".";
        if (char === "." || char === "g") {
          continue;
        }
        const x = x0 + sx + Math.round(Math.sin(r * 0.9 - t * 2) * 1);
        if (
          x >= 0 &&
          x < w &&
          y < h &&
          (fade >= 1 || (BAYER[(y & 3) * 4 + (x & 3)] ?? 0) < fade)
        ) {
          buf[y * w + x] = r > reflect * 0.6 ? A_ORANGE_DARK : A_REFLECT;
        }
      }
    }
  }

  // A removed pumpkin goes up in a puff of fog
  for (const poof of input.poofs) {
    const age = t - poof.t;
    if (age < 0 || age > POOF_LIFE) {
      continue;
    }
    const spread = 3 + age * 22;
    for (let k = 0; k < 18; k += 1) {
      if (hash(k, 70) < age / POOF_LIFE) {
        continue;
      }
      const angle = hash(k, 71) * Math.PI * 2;
      const dist = spread * (0.4 + hash(k, 72) * 0.6);
      const x = Math.round(poof.x + Math.cos(angle) * dist);
      const y = Math.round(poof.y + Math.sin(angle) * dist * 0.6 - age * 8);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as const) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          buf[py * w + px] = top - 1;
        }
      }
    }
  }

  // Ghost drifting over the left shore
  const ghostScale = w > 220 ? 2 : 1;
  const ghostW = (GHOST[0]?.length ?? 0) * ghostScale;
  const ghostH = GHOST.length * ghostScale;
  const homeX = w * GHOST_AT.fx + Math.sin(t * 0.5) * 4;
  const homeY = h * GHOST_AT.fy - ghostH / 2 + Math.sin(t * 1.3) * 3;
  const gx = Math.round(homeX - ghostW / 2);
  const gy = Math.round(homeY - ghostH / 2);
  const blink = t % 4.3 < 0.15;
  stamp(buf, w, h, GHOST, gx, gy, ghostScale, (char, x, y) => {
    if (char === "k") {
      const eyes = Math.floor((y - gy) / ghostScale) < 5;
      return blink && eyes ? top : 0;
    }
    if (char === ":") {
      return (x + y) % 2 === 0 ? top : undefined;
    }
    return top;
  });
}

// Sprite and bounds of a pumpkin in buffer pixels
export function pumpkinBox(
  p: Pick<FloatingPumpkin, "fx" | "fy" | "scale">,
  w: number,
  h: number
) {
  const sprite = p.scale === 0 ? PUMPKIN_S : PUMPKIN_M;
  const scale = p.scale === 2 ? 2 : 1;
  const sw = (sprite[0]?.length ?? 0) * scale;
  const sh = sprite.length * scale;
  const waterline = Math.round(p.fy * h);
  return {
    sprite,
    scale,
    sw,
    sh,
    waterline,
    x0: Math.round(p.fx * w - sw / 2),
  };
}

// Pumpkins further out on the lake are drawn smaller.
export function pumpkinScaleAt(y: number, layout: Layout): 0 | 1 | 2 {
  const depth = (y - layout.horizon) / (layout.h - layout.horizon);
  if (depth < 0.12) {
    return 0;
  }
  return depth < 0.45 ? 1 : 2;
}

// 0..1 fade-in progress; a pumpkin born "after" t (clock reset) counts as settled
function settled(t: number, born: number) {
  return t < born ? 1 : Math.min(1, (t - born) / FADE_IN);
}
