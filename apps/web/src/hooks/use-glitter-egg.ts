import { useCallback, useRef, useState } from "react";
import type { MouseEvent } from "react";

import {
  GLITTER_EGG_CLICK_WINDOW_MS,
  GLITTER_EGG_CLICKS,
  GLITTER_EGG_HINT_CLICK,
} from "@/constants/landing/footer";

const WIGGLE_KEYFRAMES: Keyframe[] = [
  { transform: "rotate(0deg)" },
  { transform: "rotate(-10deg)" },
  { transform: "rotate(10deg)" },
  { transform: "rotate(0deg)" },
];

export function useGlitterEgg() {
  const [active, setActive] = useState(false);
  const clicks = useRef(0);
  const lastClick = useRef(0);

  const onMarkClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const now = performance.now();
    clicks.current =
      now - lastClick.current > GLITTER_EGG_CLICK_WINDOW_MS
        ? 1
        : clicks.current + 1;
    lastClick.current = now;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (clicks.current === GLITTER_EGG_HINT_CLICK && !reduceMotion) {
      event.currentTarget.animate(WIGGLE_KEYFRAMES, {
        duration: 350,
        easing: "ease-out",
      });
    }
    if (clicks.current >= GLITTER_EGG_CLICKS) {
      clicks.current = 0;
      setActive((current) => !current);
    }
  }, []);

  return { active, onMarkClick };
}
