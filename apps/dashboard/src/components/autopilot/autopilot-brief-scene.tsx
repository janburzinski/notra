"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";

import type { AutopilotBriefSceneSwitcherProps } from "@/types/autopilot";
import {
  BRIEF_SCENES,
  BRIEF_SCENE_COLS,
  BRIEF_SCENE_FPS,
  BRIEF_SCENE_ROWS,
  renderBriefScene,
} from "@/utils/brief-scenes";

/**
 * Today's pixel-art place across the top of the brief. Pixels stay whole: 4px
 * on phones, 5px from `sm` up, cropped at the sides rather than scaled. It
 * moves in steps, pauses off screen, and holds still for reduced motion.
 */
export function AutopilotBriefScene({ index }: { index: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!(canvas && context) || index === null) {
      return;
    }
    const paint = (seconds: number) =>
      context.putImageData(
        new ImageData(
          renderBriefScene(index, seconds),
          BRIEF_SCENE_COLS,
          BRIEF_SCENE_ROWS
        ),
        0,
        0
      );
    paint(0);
    canvas.dataset.ready = "true";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    observer.observe(canvas);

    const start = performance.now();
    let shown = 0;
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      const step = Math.floor(((now - start) / 1000) * BRIEF_SCENE_FPS);
      if (visible && step !== shown) {
        shown = step;
        paint(step / BRIEF_SCENE_FPS);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [index]);

  return (
    <div
      aria-hidden="true"
      className="bg-muted relative h-40 overflow-hidden sm:h-50"
    >
      {index === null ? null : (
        <canvas
          className="absolute top-0 left-1/2 h-40 w-128 max-w-none -translate-x-1/2 opacity-0 transition-opacity duration-300 [image-rendering:pixelated] data-ready:opacity-100 sm:h-50 sm:w-160"
          height={BRIEF_SCENE_ROWS}
          key={index}
          ref={canvasRef}
          width={BRIEF_SCENE_COLS}
        />
      )}
    </div>
  );
}

/** Dev only: step through every scene without waiting for its day. */
export function AutopilotBriefSceneSwitcher({
  index,
  onChange,
}: AutopilotBriefSceneSwitcherProps) {
  const count = BRIEF_SCENES.length;
  const step = (by: number) => onChange((index + by + count) % count);
  const buttonClass =
    "text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors";
  return (
    <div className="bg-background/90 fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-full border p-1 text-xs shadow-lg backdrop-blur">
      <button
        aria-label="Previous scene"
        className={buttonClass}
        onClick={() => step(-1)}
        type="button"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
      </button>
      <span className="min-w-36 px-1 text-center tabular-nums">
        <span className="text-muted-foreground">
          {index + 1}/{count}
        </span>{" "}
        {BRIEF_SCENES[index]?.name}
      </span>
      <button
        aria-label="Next scene"
        className={buttonClass}
        onClick={() => step(1)}
        type="button"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
