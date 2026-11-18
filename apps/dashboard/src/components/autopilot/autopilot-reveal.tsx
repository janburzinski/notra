"use client";

import { EASE } from "@notra/ui/lib/motion";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";

import { AUTOPILOT_ONBOARDING_ENDING as ENDING } from "@/constants/autopilot-onboarding";
import type { AutopilotRevealProps } from "@/types/autopilot-onboarding";

/**
 * A piece of the Autopilot page that waits under Ollie's chat and rises in
 * once it's over, a beat after the piece before it.
 */
export function AutopilotReveal({
  hidden,
  index,
  className,
  children,
}: AutopilotRevealProps) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        animate={
          hidden
            ? { opacity: 0, y: ENDING.rise, filter: `blur(${ENDING.blur}px)` }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        className={className}
        initial={false}
        transition={
          reduceMotion || hidden
            ? { duration: 0 }
            : {
                duration: ENDING.revealDuration,
                ease: EASE.out,
                delay: ENDING.revealDelay + index * ENDING.revealStagger,
              }
        }
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
