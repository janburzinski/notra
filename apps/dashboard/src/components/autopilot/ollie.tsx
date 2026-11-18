"use client";

import { cn } from "@notra/ui/lib/utils";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import {
  OLLIE_BLINK_EVERY_MS,
  OLLIE_BLINK_MS,
  OLLIE_CHEEKS,
  OLLIE_COLORS,
  OLLIE_EYES,
  OLLIE_HEAD,
  OLLIE_MOUTHS,
  OLLIE_TEMPO,
  OLLIE_TENTACLES,
  OLLIE_THOUGHT_DOTS,
} from "@/constants/ollie";
import type { OllieProps } from "@/types/autopilot-onboarding";

function rowsToPixels(rows: readonly string[], top: number) {
  return rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) =>
      cell in OLLIE_COLORS
        ? [[x, y + top, cell as keyof typeof OLLIE_COLORS] as const]
        : []
    )
  );
}

const HEAD = rowsToPixels(OLLIE_HEAD, 0);
const TENTACLES = OLLIE_TENTACLES.map((rows) =>
  rowsToPixels(rows, OLLIE_HEAD.length)
);

/** Counts up every `ms`; 0 or reduced motion keeps it still. */
function useTick(ms: number, still: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (still || ms <= 0) {
      return;
    }
    const id = window.setInterval(() => setTick((value) => value + 1), ms);
    return () => window.clearInterval(id);
  }, [ms, still]);
  return tick;
}

function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false);
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- one timer is pending at a time and the cleanup clears it
  useEffect(() => {
    if (!enabled) {
      return;
    }
    // One timer at a time: open for a while, shut for a blink, repeat.
    let timer = 0;
    const open = () => {
      setClosed(false);
      timer = window.setTimeout(shut, OLLIE_BLINK_EVERY_MS);
    };
    const shut = () => {
      setClosed(true);
      timer = window.setTimeout(open, OLLIE_BLINK_MS);
    };
    timer = window.setTimeout(shut, OLLIE_BLINK_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return enabled && closed;
}

/** Ollie, Autopilot's pixel octopus, in the mood of what it's doing. */
export function Ollie({ mood, animated = true, className }: OllieProps) {
  const reduceMotion = (useReducedMotion() ?? false) || !animated;
  const tempo = OLLIE_TEMPO[mood];
  const tentacleTick = useTick(tempo.tentacles, reduceMotion);
  const mouthTick = useTick(tempo.mouth, reduceMotion);
  const blinking = useBlink(
    !reduceMotion && (mood === "idle" || mood === "talking")
  );
  let eyes: (typeof OLLIE_EYES)[keyof typeof OLLIE_EYES] = OLLIE_EYES.open;
  if (mood === "happy") {
    eyes = OLLIE_EYES.happy;
  } else if (mood === "thinking") {
    eyes = OLLIE_EYES.thinking;
  } else if (blinking) {
    eyes = OLLIE_EYES.closed;
  }
  let mouth: (typeof OLLIE_MOUTHS)[keyof typeof OLLIE_MOUTHS] =
    OLLIE_MOUTHS.closed;
  if (mood === "thinking") {
    mouth = OLLIE_MOUTHS.pursed;
  } else if (mood === "talking" && mouthTick % 2 === 1) {
    mouth = OLLIE_MOUTHS.open;
  }
  // The thought bubble grows a dot a beat; still, it shows all three.
  const thoughts =
    mood === "thinking"
      ? OLLIE_THOUGHT_DOTS.slice(
          0,
          reduceMotion ? OLLIE_THOUGHT_DOTS.length : mouthTick % 4
        )
      : [];
  // Later layers paint over earlier ones: eyes and mouth over the head.
  const pixels = new Map<string, readonly [number, number, string]>();
  for (const [x, y, color] of [
    ...HEAD,
    ...(TENTACLES[tentacleTick % TENTACLES.length] ?? []),
    ...OLLIE_CHEEKS,
    ...eyes,
    ...mouth,
    ...thoughts,
  ]) {
    pixels.set(`${x}-${y}`, [x, y, OLLIE_COLORS[color]]);
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <svg
        aria-hidden="true"
        className={cn("size-16 shrink-0 overflow-visible", className)}
        shapeRendering="crispEdges"
        viewBox="0 0 16 16"
      >
        <m.g
          animate={reduceMotion ? { y: 0 } : { y: [0, -tempo.lift, 0] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: tempo.bob / 1000,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        >
          {[...pixels].map(([key, [x, y, color]]) => (
            <rect fill={color} height={1} key={key} width={1} x={x} y={y} />
          ))}
        </m.g>
      </svg>
    </LazyMotion>
  );
}
