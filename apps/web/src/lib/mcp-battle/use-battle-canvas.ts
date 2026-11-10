import { useEffect, useRef } from "react";

import {
  BATTLE_ART_PX,
  BATTLE_DARK_THEME,
  BATTLE_LIGHT_THEME,
  BATTLE_STILL_S,
} from "@/constants/mcp-battle";
import { BattleEngine } from "@/lib/mcp-battle/engine";
import { loadBattleMasks, paintBattleSprites } from "@/lib/mcp-battle/sprites";
import type {
  BattleCanvasOptions,
  BattleCanvasRefs,
  BattleMasks,
  BattleRect,
  BattleSprites,
} from "@/types/mcp-battle";

const STILL_STEP_S = 1 / 60;
/** Clicks on these, or anything inside them, are the page's own and never fire. */
const INTERACTIVE =
  "a, button, input, textarea, select, [role='tab'], [role='button']";

/**
 * Runs the space fight on a canvas inside `stageRef`, keeping the ships clear of `avoidRef` and firing
 * a Notra strike where the visitor clicks empty parts of `areaRef`. It only animates while the stage is
 * on screen and the tab is open; under reduced motion it draws one still and ignores clicks.
 */
export function useBattleCanvas(
  { avoidRef, areaRef }: BattleCanvasRefs,
  { dark, reducedMotion }: BattleCanvasOptions
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef(dark);
  const repaintRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    darkRef.current = dark;
    repaintRef.current();
  }, [dark]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.imageRendering = "pixelated";
    stage.prepend(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const engine = new BattleEngine();
    let masks: BattleMasks = { ships: [], boss: [] };
    let sprites: BattleSprites = {
      tinted: [],
      flash: [],
      boss: [],
      bossFlash: [],
    };
    let visible = false;
    let frame = 0;
    let last = 0;
    let settled = !reducedMotion;
    let disposed = false;

    const theme = () =>
      darkRef.current ? BATTLE_DARK_THEME : BATTLE_LIGHT_THEME;
    const draw = () => {
      engine.render(ctx, theme(), sprites);
      // shake in whole art pixels so the picture stays on the grid
      const amount = Math.round(engine.shake);
      canvas.style.transform =
        amount > 0
          ? `translate(${Math.round((Math.random() * 2 - 1) * amount) * BATTLE_ART_PX}px, ${Math.round((Math.random() * 2 - 1) * amount) * BATTLE_ART_PX}px)`
          : "";
    };
    const running = () => !reducedMotion && visible && !document.hidden;
    const tick = (now: number) => {
      engine.simulate(Math.min(0.05, (now - last) / 1000));
      last = now;
      draw();
      frame = running() ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (frame || !running()) {
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    repaintRef.current = () => {
      sprites = paintBattleSprites(masks, darkRef.current);
      if (!frame) {
        draw();
      }
    };

    const avoidRect = (): BattleRect | null => {
      const avoid = avoidRef.current;
      if (!avoid) {
        return null;
      }
      const s = stage.getBoundingClientRect();
      const a = avoid.getBoundingClientRect();
      return {
        x: (a.left - s.left) / BATTLE_ART_PX,
        y: (a.top - s.top) / BATTLE_ART_PX,
        w: a.width / BATTLE_ART_PX,
        h: a.height / BATTLE_ART_PX,
      };
    };

    const resize = () => {
      const width = Math.ceil(stage.clientWidth / BATTLE_ART_PX);
      const height = Math.ceil(stage.clientHeight / BATTLE_ART_PX);
      canvas.width = width;
      canvas.height = height;
      // whole-pixel scaling keeps every art pixel the same size
      canvas.style.width = `${width * BATTLE_ART_PX}px`;
      canvas.style.height = `${height * BATTLE_ART_PX}px`;
      ctx.imageSmoothingEnabled = false;
      engine.resize(width, height, avoidRect());
      if (!settled && width > 0 && height > 0) {
        settled = true;
        for (let t = 0; t < BATTLE_STILL_S; t += STILL_STEP_S) {
          engine.simulate(STILL_STEP_S);
        }
      }
      if (!frame) {
        draw();
      }
    };
    resize();

    loadBattleMasks().then((loaded) => {
      if (disposed) {
        return;
      }
      masks = loaded;
      repaintRef.current();
    });

    const area = areaRef.current;
    const strike = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        reducedMotion ||
        event.button !== 0 ||
        target?.closest(INTERACTIVE) ||
        (target && avoidRef.current?.contains(target))
      ) {
        return;
      }
      const s = stage.getBoundingClientRect();
      engine.strike(
        (event.clientX - s.left) / BATTLE_ART_PX,
        (event.clientY - s.top) / BATTLE_ART_PX
      );
      wake();
    };
    area?.addEventListener("pointerdown", strike);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    if (avoidRef.current) {
      resizeObserver.observe(avoidRef.current);
    }
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      wake();
    });
    visibility.observe(stage);
    document.addEventListener("visibilitychange", wake);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      repaintRef.current = () => undefined;
      area?.removeEventListener("pointerdown", strike);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", wake);
      canvas.remove();
    };
  }, [areaRef, avoidRef, reducedMotion]);

  return stageRef;
}
