import { MODELS } from "@/constants/models";
import { GLYPH_H, GLYPH_W, GLYPHS } from "@/constants/pixel-font";
import { RIM, SPACE, STAR } from "@/constants/render";
import { CARD_COLORS, CARD_HEIGHT, CARD_WIDTH } from "@/constants/share-card";
import { SHIP_ART, SHIP_TONES } from "@/constants/ship-art";
import { encodePng } from "@/lib/server/png";
import type { GameStore } from "@/lib/server/store";
import { playerIdSchema } from "@/schemas/api";
import type { Rgb } from "@/types/game";
import type { ShareCard } from "@/types/leaderboard";
import { artTones, mix } from "@/utils/color";
import { formatScore } from "@/utils/format";
import { modelSpec } from "@/utils/models";
import { createRng } from "@/utils/rng";

/** Card pixels are drawn in blocks of this many screen pixels, like the game's own canvas. */
const UNIT = 6;
const MARGIN = 60;

class Raster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(width: number, height: number, background: Rgb) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
    this.rect(0, 0, width, height, background);
  }

  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        this.pixels.set(color, (py * this.width + px) * 3);
      }
    }
  }

  /** Text in the HUD's 3×5 font, `scale` screen pixels per font pixel. Returns its width. */
  text(value: string, x: number, y: number, scale: number, color: Rgb) {
    const chars = [...value.toUpperCase()];
    chars.forEach((char, index) => {
      const glyph = GLYPHS[char] ?? GLYPHS["?"] ?? [];
      const left = x + index * (GLYPH_W + 1) * scale;
      glyph.forEach((row, gy) => {
        [...row].forEach((cell, gx) => {
          if (cell === "#") {
            this.rect(left + gx * scale, y + gy * scale, scale, scale, color);
          }
        });
      });
    });
    return textWidth(value, scale);
  }

  /** Ship art with its dark rim, `scale` screen pixels per art pixel. */
  art(
    rows: readonly string[],
    x: number,
    y: number,
    scale: number,
    tones: Record<string, Rgb>
  ) {
    const on = (ax: number, ay: number) => {
      const cell = rows[ay]?.[ax];
      return cell !== undefined && cell !== ".";
    };
    for (let ay = -1; ay <= rows.length; ay += 1) {
      for (let ax = -1; ax <= rows.length; ax += 1) {
        const tone = tones[rows[ay]?.[ax] ?? "."];
        const rim =
          on(ax - 1, ay) || on(ax + 1, ay) || on(ax, ay - 1) || on(ax, ay + 1);
        if (tone || rim) {
          this.rect(x + ax * scale, y + ay * scale, scale, scale, tone ?? RIM);
        }
      }
    }
  }
}

function textWidth(value: string, scale: number) {
  const length = [...value].length;
  return length === 0 ? 0 : (length * (GLYPH_W + 1) - 1) * scale;
}

/** A stable number from a player id, so the same player always gets the same sky. */
function seedOf(id: string) {
  let hash = 0x81_1c_9d_c5;
  for (const char of id) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01_00_01_93);
  }
  return hash >>> 0;
}

type Area = readonly [left: number, top: number, right: number, bottom: number];

/** Where a player card's text goes; stars stay out so they never touch a letter. */
const PLAYER_TEXT_AREAS: readonly Area[] = [
  [450, 60, 1160, 530],
  [50, 530, 1160, 585],
  [140, 465, 340, 515],
];

function starfield(card: Raster, seed: number, areas: readonly Area[]) {
  const random = createRng(seed);
  for (let i = 0; i < 140; i += 1) {
    const x = Math.floor(random() * (CARD_WIDTH / UNIT)) * UNIT;
    const y = Math.floor(random() * (CARD_HEIGHT / UNIT)) * UNIT;
    const glow = random();
    if (
      areas.some(
        ([left, top, right, bottom]) =>
          x >= left && x <= right && y >= top && y <= bottom
      )
    ) {
      continue;
    }
    const size = glow > 0.93 ? UNIT : UNIT / 2;
    card.rect(x, y, size, size, mix(SPACE, STAR, 0.2 + glow * 0.6));
  }
}

/** A frame with notched corners, like the game's panels. */
function frame(card: Raster) {
  const inset = 24;
  const w = CARD_WIDTH - inset * 2;
  const h = CARD_HEIGHT - inset * 2;
  card.rect(inset + UNIT, inset, w - UNIT * 2, UNIT, CARD_COLORS.line);
  card.rect(
    inset + UNIT,
    inset + h - UNIT,
    w - UNIT * 2,
    UNIT,
    CARD_COLORS.line
  );
  card.rect(inset, inset + UNIT, UNIT, h - UNIT * 2, CARD_COLORS.line);
  card.rect(
    inset + w - UNIT,
    inset + UNIT,
    UNIT,
    h - UNIT * 2,
    CARD_COLORS.line
  );
}

/** What a card shows, or null for an unknown id or a player without a saved score. */
export async function readShareCard(
  store: GameStore,
  playerId: string
): Promise<ShareCard | null> {
  const id = playerIdSchema.safeParse(playerId);
  if (!id.success) {
    return null;
  }
  const [player, all, week] = await Promise.all([
    store.profile(id.data),
    store.standing("all", id.data),
    store.standing("week", id.data),
  ]);
  return player && all ? { player, all, week } : null;
}

/** A 1200×630 PNG of a player's spot on the board, drawn on the game's pixel grid. */
export function renderShareCard({ player, all, week }: ShareCard) {
  const card = new Raster(CARD_WIDTH, CARD_HEIGHT, SPACE);
  const spec = modelSpec(all.model);
  starfield(card, seedOf(player.id), PLAYER_TEXT_AREAS);
  frame(card);

  // the ship, big, on the left
  const shipScale = 20;
  const shipSize = SHIP_ART[all.model].length * shipScale;
  const shipX = MARGIN + 30;
  const shipY = (CARD_HEIGHT - shipSize) / 2 - 20;
  card.art(
    SHIP_ART[all.model],
    shipX,
    shipY,
    shipScale,
    artTones(spec.color, SHIP_TONES[all.model])
  );
  const modelName = spec.name;
  card.text(
    modelName,
    shipX + (shipSize - textWidth(modelName, 5)) / 2,
    shipY + shipSize + 34,
    5,
    spec.color
  );

  // who, where and how much, on the right
  const left = 470;
  card.text("Notra Dogfight", left, 72, 5, CARD_COLORS.violet);
  card.text(`@${player.handle}`, left, 140, 7, CARD_COLORS.ink);

  card.text("All-time rank", left, 212, 4, CARD_COLORS.ink3);
  const rank = String(all.rank);
  const rankTop = 246;
  const rankScale = rank.length > 3 ? 16 : 22;
  card.text(rank, left, rankTop, rankScale, CARD_COLORS.gold);
  const scoreTop = rankTop + GLYPH_H * rankScale + 34;
  card.text(
    `${formatScore(all.score)} pts`,
    left,
    scoreTop,
    8,
    CARD_COLORS.ink
  );
  const statsTop = scoreTop + GLYPH_H * 8 + 26;
  const waveWidth = card.text(
    `Wave ${all.wave}`,
    left,
    statsTop,
    4,
    CARD_COLORS.ink3
  );
  card.text(
    `${all.kills} kills`,
    left + waveWidth + 40,
    statsTop,
    4,
    CARD_COLORS.ink3
  );
  if (week) {
    card.text(
      `Rank ${week.rank} this week`,
      left,
      statsTop + 38,
      4,
      CARD_COLORS.violet
    );
  }

  footer(card, "Can you beat me?");
  return encodePng(card.width, card.height, card.pixels);
}

/** A line on the left and the game's address on the right, along the bottom. */
function footer(card: Raster, line: string) {
  const top = CARD_HEIGHT - MARGIN - GLYPH_H * 5;
  card.text(line, MARGIN + 10, top, 5, CARD_COLORS.ink);
  const site = "play.usenotra.com";
  card.text(
    site,
    CARD_WIDTH - MARGIN - 10 - textWidth(site, 5),
    top,
    5,
    CARD_COLORS.violet
  );
}
