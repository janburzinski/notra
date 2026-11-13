import {
  BOSS_ART_SCALE,
  BOSS_FRAMES,
  BOSS_SIZE,
  WHITE,
} from "@/constants/game";
import { MODELS } from "@/constants/models";
import { RIM } from "@/constants/render";
import { SHIP_ART, SHIP_TONES } from "@/constants/ship-art";
import type { ModelId, Rgb } from "@/types/game";
import type { ModelSprites, SpriteSheet } from "@/types/render";
import { artTones } from "@/utils/color";

/**
 * Scale2x (EPX): doubles pixel art and rounds its staircases, so a diagonal line stays a line instead
 * of a row of corner-touching blocks. Run a few times before rotating, like RotSprite.
 */
function scale2x(rows: readonly string[]) {
  const size = rows.length;
  const at = (x: number, y: number) =>
    rows[Math.min(size - 1, Math.max(0, y))]?.[
      Math.min(size - 1, Math.max(0, x))
    ] ?? ".";
  const out: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let upper = "";
    let lower = "";
    for (let x = 0; x < size; x += 1) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      upper += c === a && c !== d && a !== b ? a : p;
      upper += a === b && a !== c && b !== d ? b : p;
      lower += d === c && d !== b && c !== a ? c : p;
      lower += b === d && b !== a && d !== c ? d : p;
    }
    out.push(upper, lower);
  }
  return out;
}

/** Smoothing passes before a boss frame is rotated: 2³ = 8× the art. */
const SMOOTH_PASSES = 3;

/** The art turned by `angle` and scaled up, sampled pixel by pixel so it stays on the grid. */
function rotated(
  art: readonly string[],
  size: number,
  scale: number,
  angle: number
) {
  let rows = art;
  for (let pass = 0; pass < SMOOTH_PASSES; pass += 1) {
    rows = scale2x(rows);
  }
  const smooth = rows.length / art.length;
  const length = rows.length;
  const centre = size / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = "";
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5 - centre;
      const sx = Math.floor(
        ((dx * cos + dy * sin) / scale) * smooth + length / 2
      );
      const sy = Math.floor(
        ((-dx * sin + dy * cos) / scale) * smooth + length / 2
      );
      row += rows[sy]?.[sx] ?? ".";
    }
    out.push(row);
  }
  return out;
}

/**
 * Paints pixel art with a dark rim; `flat` paints every pixel in one colour, for hit flashes. `custom`
 * replaces the lit, base and shaded tones for logos with colours of their own.
 */
function paint(
  rows: readonly string[],
  rgb: Rgb,
  flat = false,
  custom?: Record<string, Rgb>
) {
  const size = rows.length;
  const canvas = document.createElement("canvas");
  canvas.width = size + 2;
  canvas.height = size + 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const tones = artTones(rgb, custom);
  const on = (x: number, y: number) => {
    const ch = rows[y]?.[x];
    return ch !== undefined && ch !== ".";
  };
  const image = ctx.createImageData(size + 2, size + 2);
  const set = (x: number, y: number, color: Rgb, alpha: number) => {
    const i = ((y + 1) * (size + 2) + x + 1) * 4;
    image.data[i] = color[0];
    image.data[i + 1] = color[1];
    image.data[i + 2] = color[2];
    image.data[i + 3] = alpha;
  };
  for (let y = -1; y <= size; y += 1) {
    for (let x = -1; x <= size; x += 1) {
      const tone = flat && on(x, y) ? rgb : tones[rows[y]?.[x] ?? "."];
      if (tone) {
        set(x, y, tone, 255);
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        set(x, y, RIM, 210);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function modelSprites(id: ModelId, color: Rgb): ModelSprites {
  const art = SHIP_ART[id];
  const tones = SHIP_TONES[id];
  const frames = Array.from({ length: BOSS_FRAMES }, (_, frame) =>
    rotated(art, BOSS_SIZE, BOSS_ART_SCALE, (frame / BOSS_FRAMES) * Math.PI * 2)
  );
  return {
    id,
    ship: paint(art, color, false, tones),
    flash: paint(art, WHITE, true),
    boss: frames.map((rows) => paint(rows, color, false, tones)),
    bossFlash: frames.map((rows) => paint(rows, WHITE, true)),
  };
}

let sheet: SpriteSheet | null = null;

/** Paints every model's ship and boss once per page. */
export function spriteSheet(): SpriteSheet {
  if (!sheet) {
    const byId = {} as SpriteSheet;
    for (const model of MODELS) {
      byId[model.id] = modelSprites(model.id, model.color);
    }
    sheet = byId;
  }
  return sheet;
}
