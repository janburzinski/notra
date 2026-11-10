import {
  BATTLE_BOSS_FACTION,
  BATTLE_BOSS_FRAMES,
  BATTLE_BOSS_SIZE,
  BATTLE_FACTIONS,
  BATTLE_SPRITE_SIZE,
} from "@/constants/mcp-battle";
import type { BattleMasks, BattleSprites, Rgb } from "@/types/mcp-battle";

/** Below this alpha a logo pixel is left out, so the edges stay hard. */
const ALPHA_CUTOFF = 100;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Rasterises a logo to a square grid of art pixels, turned by `angle`, and keeps which pixels are set. */
function rasterise(
  image: HTMLImageElement,
  size: number,
  angle = 0,
  scale = 1
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  const ratio = image.naturalWidth / image.naturalHeight || 1;
  const fit = size * scale;
  const w = ratio >= 1 ? fit : fit * ratio;
  const h = ratio >= 1 ? fit / ratio : fit;
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  const { data } = ctx.getImageData(0, 0, size, size);
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = (data[i * 4 + 3] ?? 0) > ALPHA_CUTOFF ? 1 : 0;
  }
  return mask;
}

export async function loadBattleMasks(): Promise<BattleMasks> {
  const images = await Promise.all(
    BATTLE_FACTIONS.map((faction) =>
      loadImage(faction.logoSrc).catch(() => null)
    )
  );
  const ships = images.map((image) =>
    image ? rasterise(image, BATTLE_SPRITE_SIZE) : null
  );
  const bossImage = images[BATTLE_BOSS_FACTION];
  const boss: Uint8Array[] = [];
  if (bossImage) {
    // the logo is a little smaller than the frame so its points never clip while it spins
    for (let frame = 0; frame < BATTLE_BOSS_FRAMES; frame += 1) {
      const mask = rasterise(
        bossImage,
        BATTLE_BOSS_SIZE,
        (frame / BATTLE_BOSS_FRAMES) * Math.PI * 2,
        0.94
      );
      if (mask) {
        boss.push(mask);
      }
    }
  }
  return { ships, boss };
}

/**
 * Paints a mask. With `bevel`, edge pixels facing up-left are lit and those facing down-right shaded,
 * which gives the big boss some volume; small ships stay flat.
 */
function paint(mask: Uint8Array, size: number, rgb: Rgb, bevel = false) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  const lit = mix(rgb, WHITE, 0.35);
  const shade = mix(rgb, BLACK, 0.3);
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && mask[y * size + x] === 1;
  const image = ctx.createImageData(size, size);
  mask.forEach((set, i) => {
    if (!set) {
      return;
    }
    const x = i % size;
    const y = Math.floor(i / size);
    let color = rgb;
    if (bevel) {
      if (!(on(x, y - 1) && on(x - 1, y))) {
        color = lit;
      } else if (!(on(x, y + 1) && on(x + 1, y))) {
        color = shade;
      }
    }
    image.data[i * 4] = color[0];
    image.data[i * 4 + 1] = color[1];
    image.data[i * 4 + 2] = color[2];
    image.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function paintBattleSprites(
  masks: BattleMasks,
  dark: boolean
): BattleSprites {
  const bossFaction = BATTLE_FACTIONS[BATTLE_BOSS_FACTION];
  const bossShade = dark ? bossFaction?.dark : bossFaction?.light;
  const bossRgb = bossShade ?? WHITE;
  const frames = (rgb: Rgb, bevel: boolean) =>
    masks.boss
      .map((mask) => paint(mask, BATTLE_BOSS_SIZE, rgb, bevel))
      .filter((frame): frame is HTMLCanvasElement => frame !== undefined);
  return {
    tinted: masks.ships.map((mask, i) => {
      const faction = BATTLE_FACTIONS[i];
      return mask && faction
        ? paint(mask, BATTLE_SPRITE_SIZE, dark ? faction.dark : faction.light)
        : undefined;
    }),
    flash: masks.ships.map((mask) =>
      mask ? paint(mask, BATTLE_SPRITE_SIZE, WHITE) : undefined
    ),
    boss: frames(bossRgb, true),
    bossFlash: frames(WHITE, false),
  };
}
