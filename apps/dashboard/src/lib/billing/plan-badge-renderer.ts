import type { Gpu } from "vgpu";

import { PLAN_BADGE_FINISHES } from "@/constants/plan-badge";
import type { PlanBadgeTier } from "@/types/billing/plan-badge";

const RADIUS_TO_HEIGHT = 0.3;
const REDUCED_MOTION_TIME = 1.1;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let sharedGpu: Promise<Gpu> | null = null;

function loadGpu() {
  sharedGpu ??= import("vgpu").then((vgpu) => vgpu.init());
  sharedGpu.catch(() => {
    sharedGpu = null;
  });
  return sharedGpu;
}

function isLightTheme() {
  return !document.documentElement.classList.contains("dark");
}

/**
 * Starts the smoked-glass shader on `canvas`. Every resource registers its
 * cleanup in `cleanups` as soon as it exists, so the caller can release a
 * half-started renderer too. Resolves false when `signal` aborted first.
 */
export async function startPlanBadgeRenderer(
  canvas: HTMLCanvasElement,
  tier: PlanBadgeTier,
  cleanups: (() => void)[],
  signal: AbortSignal
) {
  const [vgpu, { default: chromeShader }, gpu] = await Promise.all([
    import("vgpu"),
    import("@/shaders/chrome-badge.wgsl"),
    loadGpu(),
  ]);
  if (signal.aborted) {
    return false;
  }

  const finish = PLAN_BADGE_FINISHES[tier];
  const themeTint = (): [number, number, number, number] => [
    ...finish.tint,
    isLightTheme() ? 1 : 0,
  ];

  const canvasSurface = vgpu.surface(gpu, canvas, {
    clearColor: [0, 0, 0, 0],
    dpr: [1, 3],
  });
  cleanups.push(() => canvasSurface.dispose());

  const chrome = vgpu.effect(gpu, chromeShader, {
    set: {
      params: {
        dpr: 1,
        glint: finish.glint,
        iridescence: finish.iridescence,
        radius: 0,
        size: [1, 1],
        time: 0,
        tint: themeTint(),
      },
    },
  });
  cleanups.push(() => chrome.dispose());

  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  // Resizes can fire inside a frame, so the still frame waits for the next one.
  let stillFrame = 0;
  const drawStill = () => {
    if (!motion.matches || stillFrame) {
      return;
    }
    stillFrame = requestAnimationFrame(() => {
      stillFrame = 0;
      chrome.set({ params: { time: REDUCED_MOTION_TIME } });
      vgpu.frame(gpu, (frame) => frame.pass(canvasSurface, chrome));
    });
  };
  cleanups.push(() => cancelAnimationFrame(stillFrame));

  const unsubscribe = canvasSurface.onResize(({ dpr, height, width }) => {
    chrome.set({
      params: {
        dpr,
        radius: height * RADIUS_TO_HEIGHT,
        size: [width, height],
      },
    });
    drawStill();
  });
  cleanups.push(unsubscribe);

  const themeObserver = new MutationObserver(() => {
    chrome.set({ params: { tint: themeTint() } });
    drawStill();
  });
  themeObserver.observe(document.documentElement, {
    attributeFilter: ["class"],
  });
  cleanups.push(() => themeObserver.disconnect());

  const startedAt = performance.now();
  let loop: { stop: () => void } | null = null;
  const applyMotion = () => {
    loop?.stop();
    loop = null;
    if (motion.matches) {
      drawStill();
      return;
    }
    loop = vgpu.frameLoop(gpu, (frame) => {
      chrome.set({
        params: { time: (performance.now() - startedAt) / 1000 },
      });
      frame.pass(canvasSurface, chrome);
    });
  };
  applyMotion();
  motion.addEventListener("change", applyMotion);
  cleanups.push(() => {
    motion.removeEventListener("change", applyMotion);
    loop?.stop();
  });

  return true;
}
