import { ARENA_H, ARENA_W, NOTRA_VIOLET, WHITE } from "@/constants/game";
import { ARENA_EDGE, SPACE, STAR, STAR_COUNT } from "@/constants/render";
import type { Rgb } from "@/types/game";
import type { Star } from "@/types/render";

const STARS_PER_PIXEL = STAR_COUNT / (ARENA_W * ARENA_H);

function rgba([r, g, b]: Rgb, alpha: number) {
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/**
 * The sky around the arena, so the game fills the whole tab while the playing field keeps its fixed
 * size. It sits under the arena canvas on the same pixel grid, drifts like the arena's own stars and
 * marks the arena's edge, where the ship stops.
 */
export class Backdrop {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private time = 0;
  /** Art pixels between the canvas edge and the arena. */
  private padX = 0;
  private padY = 0;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.imageRendering = "pixelated";
    canvas.style.pointerEvents = "none";
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D is not available");
    }
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /**
   * Covers a stage of `width` × `height` CSS pixels around an arena drawn at `scale` CSS pixels per
   * art pixel and centred in it, with whole art pixels lined up with the arena's.
   */
  fit(width: number, height: number, scale: number) {
    const arenaLeft = (width - ARENA_W * scale) / 2;
    const arenaTop = (height - ARENA_H * scale) / 2;
    const padX = Math.max(0, Math.ceil(arenaLeft / scale));
    const padY = Math.max(0, Math.ceil(arenaTop / scale));
    const cols = ARENA_W + padX * 2;
    const rows = ARENA_H + padY * 2;
    const style = this.canvas.style;
    style.left = `${arenaLeft - padX * scale}px`;
    style.top = `${arenaTop - padY * scale}px`;
    style.width = `${cols * scale}px`;
    style.height = `${rows * scale}px`;
    if (
      cols === this.canvas.width &&
      rows === this.canvas.height &&
      this.stars.length > 0
    ) {
      return;
    }
    this.canvas.width = cols;
    this.canvas.height = rows;
    this.padX = padX;
    this.padY = padY;
    this.stars = Array.from(
      { length: Math.round(cols * rows * STARS_PER_PIXEL) },
      () => ({
        x: Math.random() * cols,
        y: Math.random() * rows,
        depth: Math.random() * Math.random(),
        phase: Math.random() * Math.PI * 2,
      })
    );
  }

  /** Moves the stars at the speed of the arena's. */
  update(dt: number) {
    this.time += dt;
    const { width, height } = this.canvas;
    for (const star of this.stars) {
      star.x -= (3 + star.depth * 10) * dt;
      if (star.x < 0) {
        star.x += width;
        star.y = Math.random() * height;
      }
    }
  }

  /** Draws the sky, the arena's edge and the reticle while the mouse is off the arena. */
  render(reticle: { x: number; y: number } | null) {
    const { ctx, padX, padY } = this;
    const { width, height } = this.canvas;
    ctx.fillStyle = rgba(SPACE, 1);
    ctx.fillRect(0, 0, width, height);
    for (const star of this.stars) {
      const twinkle = 0.7 + 0.3 * Math.sin(star.phase + this.time * 1.8);
      ctx.fillStyle = rgba(STAR, (0.12 + 0.6 * star.depth) * twinkle);
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1);
    }
    if (padX > 0 || padY > 0) {
      ctx.fillStyle = rgba(ARENA_EDGE, 1);
      ctx.fillRect(padX - 1, padY - 1, ARENA_W + 2, 1);
      ctx.fillRect(padX - 1, padY + ARENA_H, ARENA_W + 2, 1);
      ctx.fillRect(padX - 1, padY, 1, ARENA_H);
      ctx.fillRect(padX + ARENA_W, padY, 1, ARENA_H);
    }
    // the arena draws the reticle over itself; this half shows it out here, so it never vanishes
    if (reticle) {
      const x = reticle.x + padX;
      const y = reticle.y + padY;
      ctx.fillStyle = rgba(WHITE, 0.95);
      for (let i = 2; i <= 4; i += 1) {
        ctx.fillRect(x + i, y, 1, 1);
        ctx.fillRect(x - i, y, 1, 1);
        ctx.fillRect(x, y + i, 1, 1);
        ctx.fillRect(x, y - i, 1, 1);
      }
      ctx.fillStyle = rgba(NOTRA_VIOLET, 1);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
