"use client";

import { TRANSITION } from "@notra/ui/lib/motion";
import { useUiLabels } from "@notra/ui/components/shared/ui-labels-provider";
import { useVisibilityEpoch } from "@notra/ui/hooks/use-visibility-epoch";
import type { AnimatedNumberProps } from "@notra/ui/types/animated-number";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

const rest = {
  opacity: 1,
  transform: "translateY(0%)",
  filter: "blur(0px)",
};

const instant = { duration: 0 };

/**
 * Rolls only the characters that changed. Each character sits in a slot keyed
 * by its position from the right, so 98 → 99 animates just the last digit and
 * 98 → 107 animates every digit (plus the new leading slot).
 */
export function AnimatedNumber({
  value,
  className,
  locale,
}: AnimatedNumberProps) {
  const labels = useUiLabels();
  const reduceMotion = useReducedMotion();
  // A value that changes while the tab is hidden can leave the outgoing digit
  // stuck on top of the new one, so the digits remount when the tab returns.
  const visibilityEpoch = useVisibilityEpoch();
  const previousValue = useRef(value);
  const direction = value >= previousValue.current ? 1 : -1;
  const formattedValue = new Intl.NumberFormat(
    locale ?? labels.locale ?? "en-US"
  ).format(value);

  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  const isHidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  const animate = !(reduceMotion || isHidden);

  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden align-baseline tabular-nums",
        className
      )}
    >
      <span className="sr-only">{formattedValue}</span>
      <Digits
        animate={animate}
        direction={direction}
        key={visibilityEpoch}
        value={formattedValue}
      />
    </span>
  );
}

function Digits({
  value,
  direction,
  animate,
}: {
  value: string;
  direction: 1 | -1;
  animate: boolean;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  const chars = Array.from(value);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const offset = animate ? 45 * direction : 0;
  const blur = animate ? "blur(4px)" : "blur(0px)";
  const transition = animate ? TRANSITION.enter : instant;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {chars.map((char, index) => {
        const slot = chars.length - index;
        return (
          <motion.span
            aria-hidden="true"
            className="relative inline-grid"
            exit={{ opacity: 0 }}
            key={`slot-${slot}`}
            layout="position"
            transition={transition}
          >
            <AnimatePresence initial={hasMounted} mode="popLayout">
              <motion.span
                animate={rest}
                className="col-start-1 row-start-1 block"
                exit={{
                  opacity: 0,
                  transform: `translateY(${-offset}%)`,
                  filter: blur,
                }}
                initial={{
                  opacity: 0,
                  transform: `translateY(${offset}%)`,
                  filter: blur,
                }}
                key={char}
                transition={transition}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        );
      })}
    </AnimatePresence>
  );
}
