import { useEffect, useRef } from "react";

import {
  GLITTER_GRADIENT_DARK,
  GLITTER_GRADIENT_LIGHT,
  GLITTER_WORDMARK,
} from "@/constants/landing/footer";
import type {
  GlitterRgb,
  GlitterTheme,
  GlitterWordmarkProps,
} from "@/types/landing/footer";

interface Cell {
  x: number;
  y: number;
  hue: number;
  diagonal: number;
  flake: number;
  phase: number;
  speed: number;
  reveal: number;
}

interface Star {
  x: number;
  y: number;
  born: number;
}

interface Pointer {
  x: number;
  y: number;
  inside: boolean;
  strength: number;
}

let fontPromise: Promise<void> | null = null;

function loadGlitterFont() {
  fontPromise ??= new FontFace(
    GLITTER_WORDMARK.fontFamily,
    `url(${GLITTER_WORDMARK.fontUrl})`,
    { weight: "800" }
  )
    .load()
    .then((face) => {
      document.fonts.add(face);
    });
  return fontPromise;
}

function buildCells(): Cell[] {
  const { columns, rows, text, fontFamily } = GLITTER_WORDMARK;
  const mask = document.createElement("canvas");
  mask.width = columns;
  mask.height = rows;
  const ctx = mask.getContext("2d");
  if (!ctx) {
    return [];
  }

  ctx.textAlign = "center";
  ctx.letterSpacing = "-1px";
  ctx.font = `800 64px ${fontFamily}, Inter, system-ui, sans-serif`;
  const fontSize = (64 * (columns * 0.96)) / ctx.measureText(text).width;
  ctx.font = `800 ${fontSize}px ${fontFamily}, Inter, system-ui, sans-serif`;
  const capHeight = fontSize * 0.727;
  ctx.fillText(text, columns / 2, 4 + capHeight * 1.22);

  const { data } = ctx.getImageData(0, 0, columns, rows);
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if ((data[(y * columns + x) * 4 + 3] ?? 0) < 110) {
        continue;
      }
      // Most flakes sit near the middle; a few are dark gaps or bright facets.
      const roll = Math.random();
      let flake = 0.7 + roll * 0.25;
      if (roll < 0.12) {
        flake = 0.35;
      } else if (roll > 0.9) {
        flake = 1.15;
      }
      cells.push({
        x,
        y,
        hue: x / columns + (y / rows) * 0.12 + (Math.random() - 0.5) * 0.05,
        diagonal: x / columns + (y / rows) * 0.35,
        flake,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 2.2,
        reveal: Math.random(),
      });
    }
  }
  return cells;
}

function sampleGradient(stops: readonly GlitterRgb[], at: number): GlitterRgb {
  const wrapped = ((at % 1) + 1) % 1;
  const scaled = wrapped * stops.length;
  const index = Math.floor(scaled);
  const from = stops[index % stops.length] ?? [255, 255, 255];
  const to = stops[(index + 1) % stops.length] ?? from;
  const mix = scaled - index;
  return [
    from[0] + (to[0] - from[0]) * mix,
    from[1] + (to[1] - from[1]) * mix,
    from[2] + (to[2] - from[2]) * mix,
  ];
}

function shade(
  base: GlitterRgb,
  brightness: number,
  highlight: GlitterRgb,
  glint: number
) {
  const lift = Math.max(0, brightness - 1);
  const white = Math.min(1, glint + lift * 1.5);
  const scale = Math.min(1, brightness);
  const channel = (index: 0 | 1 | 2) =>
    Math.round(
      base[index] * scale + (highlight[index] - base[index] * scale) * white
    );
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

export function GlitterWordmark({ active }: GlitterWordmarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) {
      return;
    }

    let frame = 0;
    let visible = true;
    let cancelled = false;
    let cells: Cell[] = [];
    const stars: Star[] = [];
    const pointer: Pointer = { x: 0, y: 0, inside: false, strength: 0 };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    const {
      columns,
      rows,
      revealMs,
      maxStars,
      starChance,
      hoverStarChance,
      starLifeS,
      sheenPeriodS,
      sheenWidth,
      hoverRadius,
      hoverPush,
    } = GLITTER_WORDMARK;
    let startedAt = 0;

    const spawnStar = (t: number, near: Pointer | null) => {
      if (stars.length >= maxStars || cells.length === 0) {
        return;
      }
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        if (!cell) {
          continue;
        }
        if (
          near &&
          Math.hypot(cell.x - near.x, cell.y - near.y) > hoverRadius * 0.8
        ) {
          continue;
        }
        stars.push({ x: cell.x, y: cell.y, born: t });
        return;
      }
    };

    const draw = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      if (startedAt === 0) {
        startedAt = now;
      }
      const t = now / 1000;
      const progress = reduceMotion
        ? 1
        : Math.min(1, (now - startedAt) / revealMs);
      const theme: GlitterTheme = document.documentElement.classList.contains(
        "dark"
      )
        ? GLITTER_GRADIENT_DARK
        : GLITTER_GRADIENT_LIGHT;
      const px = canvas.width / columns;
      const size = px * 0.84;

      const target = pointer.inside ? 1 : 0;
      pointer.strength = reduceMotion
        ? target
        : pointer.strength + (target - pointer.strength) * 0.12;
      const hover = pointer.strength;

      const sheenAt = reduceMotion
        ? -1
        : ((t % sheenPeriodS) / sheenPeriodS) * 1.8 - 0.3;
      const drift = reduceMotion ? 0 : t * 0.025;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const cell of cells) {
        if (cell.reveal > progress) {
          continue;
        }

        const twinkle = reduceMotion
          ? 0
          : 0.22 * Math.sin(t * cell.speed + cell.phase);
        const sheen = Math.max(
          0,
          1 - Math.abs(cell.diagonal - sheenAt) / sheenWidth
        );

        let light = 0;
        let dx = 0;
        let dy = 0;
        if (hover > 0.01) {
          const ox = cell.x - pointer.x;
          const oy = cell.y - pointer.y;
          const distance = Math.hypot(ox, oy);
          if (distance < hoverRadius) {
            const falloff = 1 - distance / hoverRadius;
            light = hover * falloff * falloff;
            if (!reduceMotion && distance > 0.001) {
              const push = hover * falloff * hoverPush;
              dx = (ox / distance) * push;
              dy = (oy / distance) * push;
            }
          }
        }

        const brightness =
          Math.max(theme.floor, cell.flake + twinkle) + light * 0.6;
        const glint = sheen * sheen * 0.75 + light * 0.55;
        ctx.fillStyle = shade(
          sampleGradient(theme.stops, cell.hue + drift),
          brightness,
          theme.highlight,
          glint
        );
        ctx.fillRect((cell.x + dx) * px, (cell.y + dy) * px, size, size);
      }

      if (reduceMotion) {
        return;
      }

      if (progress >= 1 && Math.random() < starChance) {
        spawnStar(t, null);
      }
      if (hover > 0.5 && Math.random() < hoverStarChance) {
        spawnStar(t, pointer);
      }
      for (let i = stars.length - 1; i >= 0; i -= 1) {
        const star = stars[i];
        if (!star) {
          continue;
        }
        const age = (t - star.born) / starLifeS;
        if (age > 1) {
          stars.splice(i, 1);
          continue;
        }
        const glow = Math.sin(age * Math.PI);
        const arm = Math.round(glow * 3);
        const cx = star.x * px;
        const cy = star.y * px;
        ctx.fillStyle = `rgb(255 255 255 / ${glow})`;
        ctx.fillRect(cx, cy, px, px);
        for (let l = 1; l <= arm; l += 1) {
          ctx.fillStyle = `rgb(255 255 255 / ${glow * (1 - l / (arm + 1))})`;
          ctx.fillRect(cx + l * px, cy, size, size);
          ctx.fillRect(cx - l * px, cy, size, size);
          ctx.fillRect(cx, cy + l * px, size, size);
          ctx.fillRect(cx, cy - l * px, size, size);
        }
      }

      if (visible) {
        frame = requestAnimationFrame(draw);
      }
    };

    const requestDraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };

    // Restarts the loop, or repaints the static frame under reduced motion.
    const redraw = () => {
      if (visible && cells.length > 0) {
        requestDraw();
      }
    };

    const resize = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * scale);
      canvas.height = Math.round((canvas.width * rows) / columns);
      if (reduceMotion) {
        redraw();
      }
    };

    // The canvas sits behind the footer content, so track the pointer on the
    // window instead of on the canvas itself.
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * columns;
      const y = ((event.clientY - rect.top) / rect.height) * rows;
      const wasInside = pointer.inside;
      pointer.inside =
        x > -hoverRadius / 2 &&
        x < columns + hoverRadius / 2 &&
        y > -hoverRadius / 2 &&
        y < rows + hoverRadius / 2;
      pointer.x = x;
      pointer.y = y;
      if (reduceMotion && (pointer.inside || wasInside)) {
        redraw();
      }
    };

    const onPointerLeave = () => {
      pointer.inside = false;
      if (reduceMotion) {
        redraw();
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      stars.length = 0;
      redraw();
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      cancelAnimationFrame(frame);
      redraw();
    });

    // The animated loop reads the theme every frame; the static frame needs a repaint.
    const themeObserver = new MutationObserver(() => {
      if (reduceMotion) {
        redraw();
      }
    });

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    motionQuery.addEventListener("change", onMotionChange);
    visibilityObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
    });

    loadGlitterFont()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) {
          return;
        }
        cells = buildCells();
        resize();
        redraw();
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      visibilityObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave
      );
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="aspect-[200/48] h-auto w-full"
    />
  );
}
