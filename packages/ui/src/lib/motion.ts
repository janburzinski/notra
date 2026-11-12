import type { Transition } from "motion/react";


/** Seconds. Mirrors `--transition-duration-*`. */
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  slower: 0.5,
} as const;

const STRONG_EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Cubic-bezier control points. Mirrors `--ease-*`. */
export const EASE = {
  out: STRONG_EASE_OUT,
  emphasized: STRONG_EASE_OUT,
  emphasizedInOut: [0.65, 0, 0.35, 1],
} as const;

export const SPRING = {
  indicator: { type: "spring", bounce: 0.2, duration: 0.4 },
  indicatorFlat: { type: "spring", bounce: 0, duration: 0.3 },
  snappy: { type: "spring", stiffness: 400, damping: 34 },
  gentle: { type: "spring", stiffness: 300, damping: 24 },
} as const satisfies Record<string, Transition>;

/** Tween using the shared scale. `duration` is a key of {@link DURATION}. */
export function tween(
  duration: keyof typeof DURATION = "normal",
  ease: keyof typeof EASE = "out"
): Transition {
  return { type: "tween", duration: DURATION[duration], ease: EASE[ease] };
}

export const TRANSITION = {
  /** Text/content swapping in place, error messages, status changes. */
  fade: tween("fast"),
  enter: tween("normal", "emphasized"),
  resize: tween("slow", "emphasizedInOut"),
} as const satisfies Record<string, Transition>;

/** Vertical fade-in. `distance` is px; negative enters from above. */
export function fadeUp(distance = 8) {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: distance },
    transition: TRANSITION.enter,
  };
}

/** Plain crossfade, for `AnimatePresence mode="wait"` swaps. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: TRANSITION.fade,
} as const;

/** Whether a CSS transition on `property` is currently running on `element`. */
export function hasRunningTransition(element: Element, property: string) {
  return element
    .getAnimations?.()
    .some(
      (animation) =>
        "transitionProperty" in animation &&
        animation.transitionProperty === property &&
        animation.playState === "running"
    ) ?? false;
}
