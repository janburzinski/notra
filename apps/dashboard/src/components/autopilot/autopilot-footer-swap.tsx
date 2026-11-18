"use client";

import { EASE } from "@notra/ui/lib/motion";
import {
  animate,
  AnimatePresence,
  m,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AUTOPILOT_ONBOARDING_SWAP as SWAP } from "@/constants/autopilot-onboarding";
import type { AutopilotFooterSwapProps } from "@/types/autopilot-onboarding";

/**
 * The chat's input row, whose contents swap: the input, a question card,
 * the setup's progress. The row keeps its bottom edge and grows or shrinks
 * to the new contents instead of jumping, and the contents cross-fade.
 */
export function AutopilotFooterSwap({
  swapKey,
  children,
}: AutopilotFooterSwapProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const content = useRef<HTMLDivElement | null>(null);
  const height = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  // While it resizes, the edge it's cut at fades instead of cutting hard.
  const [resizing, setResizing] = useState(false);
  // Set when the contents change, cleared once the row has resized to them;
  // a card that changes its own height (a longer question) is followed as is.
  const swapping = useRef(false);
  const swapKeyRef = useRef(swapKey);

  useEffect(() => {
    if (swapKeyRef.current !== swapKey) {
      swapKeyRef.current = swapKey;
      swapping.current = true;
    }
  }, [swapKey]);

  useEffect(() => {
    const element = content.current;
    if (!element) {
      return;
    }
    let running: ReturnType<typeof animate> | null = null;
    const observer = new ResizeObserver(() => {
      const next = element.offsetHeight;
      if (!measured || reduceMotion || !swapping.current) {
        running?.stop();
        height.set(next);
        setMeasured(true);
        return;
      }
      running?.stop();
      // Only growing cuts the new card short; a shrinking row shows it whole.
      setResizing(next > height.get());
      running = animate(height, next, {
        duration: SWAP.resize,
        ease: EASE.out,
        onComplete: () => {
          swapping.current = false;
          setResizing(false);
        },
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      running?.stop();
    };
  }, [height, measured, reduceMotion]);

  return (
    <m.div
      className="relative flex flex-col justify-end overflow-hidden"
      style={
        measured
          ? { height, maskImage: resizing ? SWAP.edge : undefined }
          : undefined
      }
    >
      <div ref={content}>
        <AnimatePresence initial={false} mode="wait">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: reduceMotion
                ? { duration: 0 }
                : { duration: SWAP.out, ease: EASE.out },
            }}
            initial={reduceMotion ? false : { opacity: 0, y: SWAP.rise }}
            key={swapKey}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: SWAP.in, ease: EASE.out }
            }
          >
            {children}
          </m.div>
        </AnimatePresence>
      </div>
    </m.div>
  );
}
