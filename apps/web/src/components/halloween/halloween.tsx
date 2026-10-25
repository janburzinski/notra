import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import {
  buildLayout,
  type FloatingPumpkin,
  GHOST_AT,
  PALETTES,
  paletteTable,
  PIXEL,
  pumpkinBox,
  PUMPKINS,
  pumpkinScaleAt,
  renderFrame,
  type SceneInput,
} from "./scene";

const FRAME_MS = 1000 / 12;
const MAX_EFFECTS = 8;
const MAX_PUMPKINS = 60;
// Share of placed pumpkins that come out cited
const CITED_CHANCE = 0.1;
const ENGINES = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Grok"];
// Gap between a pumpkin's stem and its tag, in CSS px
const TAG_GAP = 28;
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='button']";

export function PixelScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  // next-themes reports no theme until it mounts; the class is already set.
  const dark =
    resolvedTheme === undefined
      ? typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
      : resolvedTheme === "dark";
  const palette = dark ? PALETTES.dark : PALETTES.light;
  const reduceMotion = useReducedMotion() ?? false;
  // Kept outside the effect so placed pumpkins and the scene clock survive
  // a theme or motion-preference switch
  const pumpkinsRef = useRef<FloatingPumpkin[] | null>(null);
  const startedRef = useRef<number | null>(null);
  const [cited, setCited] = useState(() => PUMPKINS.filter((p) => p.cited));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx)) {
      return;
    }
    const table = paletteTable(palette);
    let layout = buildLayout(1, 1);
    let buf = new Uint8Array(1);
    let image = ctx.createImageData(1, 1);
    let visible = true;
    let raf = 0;
    let last = 0;
    const started = startedRef.current ?? performance.now();
    startedRef.current = started;
    const sceneTime = () =>
      reduceMotion ? 4 : (performance.now() - started) / 1000;
    const pumpkins =
      pumpkinsRef.current ?? PUMPKINS.map((p) => ({ ...p, born: -10 }));
    pumpkinsRef.current = pumpkins;
    const input: SceneInput = {
      pumpkins,
      ripples: [],
      poofs: [],
    };
    // Only clicks on the hero itself count, not overlays like the mobile menu
    const hero = canvas.closest("section");

    // Buffer coordinates of a viewport point, or null outside the hero
    const toScene = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return null;
      }
      return { x: x / PIXEL, y: y / PIXEL };
    };

    // Index of the topmost pumpkin under a point, or -1
    const pumpkinAt = (x: number, y: number) => {
      for (let i = input.pumpkins.length - 1; i >= 0; i -= 1) {
        const p = input.pumpkins[i];
        if (!p) {
          continue;
        }
        const box = pumpkinBox(p, layout.w, layout.h);
        if (
          x >= box.x0 - 2 &&
          x <= box.x0 + box.sw + 2 &&
          y >= box.waterline - box.sh - 2 &&
          y <= box.waterline + 3
        ) {
          return i;
        }
      }
      return -1;
    };

    // What a click at this event would do, if anything
    const actionAt = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const point = toScene(event.clientX, event.clientY);
      if (!point || target?.closest(INTERACTIVE)) {
        return null;
      }
      const hit = pumpkinAt(point.x, point.y);
      if (hit >= 0) {
        return { type: "remove" as const, index: hit, point };
      }
      if (point.y > layout.horizon + 3) {
        return { type: "place" as const, point };
      }
      return null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (hero) {
        hero.style.cursor = actionAt(event) ? "pointer" : "";
      }
    };

    const pushEffect = (
      effects: SceneInput["poofs"],
      effect: SceneInput["poofs"][number]
    ) => {
      effects.push(effect);
      if (effects.length > MAX_EFFECTS) {
        effects.shift();
      }
    };

    // click, not pointerdown, so a touch scroll that starts on the lake
    // does not drop a pumpkin
    const onClick = (event: MouseEvent) => {
      const action = actionAt(event);
      if (!action) {
        return;
      }
      const t = sceneTime();
      if (action.type === "remove") {
        input.pumpkins.splice(action.index, 1);
        if (!reduceMotion) {
          pushEffect(input.poofs, { ...action.point, t });
        }
      } else {
        const scale = pumpkinScaleAt(action.point.y, layout);
        const { sh } = pumpkinBox({ fx: 0, fy: 0, scale }, 1, 1);
        input.pumpkins.push({
          fx: action.point.x / layout.w,
          fy: (action.point.y + sh / 2) / layout.h,
          scale,
          cited:
            Math.random() < CITED_CHANCE
              ? ENGINES[Math.floor(Math.random() * ENGINES.length)]
              : undefined,
          // Without motion it appears settled instead of fading in
          born: reduceMotion ? -10 : t,
        });
        if (input.pumpkins.length > MAX_PUMPKINS) {
          input.pumpkins.shift();
        }
        if (!reduceMotion) {
          pushEffect(input.ripples, {
            x: action.point.x,
            y: action.point.y + sh / 2,
            t,
          });
        }
      }
      setCited(input.pumpkins.filter((p) => p.cited));
      if (reduceMotion) {
        draw(performance.now());
      }
    };

    const draw = (now: number) => {
      const t = reduceMotion ? 4 : (now - started) / 1000;
      renderFrame(buf, layout, palette, t, input);
      const data = image.data;
      for (let i = 0; i < buf.length; i += 1) {
        const rgb = table[buf[i] ?? 0] ?? [0, 0, 0];
        data[i * 4] = rgb[0];
        data[i * 4 + 1] = rgb[1];
        data[i * 4 + 2] = rgb[2];
        data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    };

    const resize = () => {
      const w = Math.max(1, Math.ceil(canvas.clientWidth / PIXEL));
      const h = Math.max(1, Math.ceil(canvas.clientHeight / PIXEL));
      canvas.width = w;
      canvas.height = h;
      layout = buildLayout(w, h);
      buf = new Uint8Array(w * h);
      image = ctx.createImageData(w, h);
      draw(performance.now());
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < FRAME_MS) {
        return;
      }
      last = now;
      draw(now);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    intersection.observe(canvas);
    resize();
    if (!reduceMotion) {
      raf = requestAnimationFrame(loop);
    }
    hero?.addEventListener("pointermove", onPointerMove, { passive: true });
    hero?.addEventListener("click", onClick);

    return () => {
      if (hero) {
        hero.style.cursor = "";
      }
      hero?.removeEventListener("pointermove", onPointerMove);
      hero?.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, [palette, reduceMotion]);

  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-[#D6CCF5] dark:bg-[#2A2140]"
    >
      <canvas
        className="absolute inset-0 size-full [image-rendering:pixelated]"
        ref={canvasRef}
      />
      {cited.map((p) => (
        <span
          className="absolute hidden -translate-x-1/2 bg-white px-1.5 py-0.5 font-mono text-xs leading-none whitespace-nowrap text-[#1E1E1E] lg:block"
          key={`${p.fx}:${p.fy}`}
          style={{
            // Keep tags near the edges inside the hero
            left: `clamp(4.5rem, ${p.fx * 100}%, calc(100% - 4.5rem))`,
            top: `calc(${p.fy * 100}% - ${pumpkinBox(p, 1, 1).sh * PIXEL + TAG_GAP}px)`,
          }}
        >
          cited by {p.cited}
        </span>
      ))}
      <span
        className="absolute hidden -translate-x-1/2 bg-[#0E0920] px-1.5 py-0.5 font-mono text-xs leading-none whitespace-nowrap text-white lg:block dark:bg-[#55467F]"
        style={{
          left: `${GHOST_AT.fx * 100}%`,
          top: `calc(${GHOST_AT.fy * 100}% - 6rem)`,
        }}
      >
        not cited
      </span>
    </div>
  );
}
