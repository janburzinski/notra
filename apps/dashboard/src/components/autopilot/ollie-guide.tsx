"use client";

import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
  useSpring,
  useMotionValue,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Ollie } from "@/components/autopilot/ollie";
import { AUTOPILOT_ONBOARDING_ENDING } from "@/constants/autopilot-onboarding";
import {
  OLLIE_CLAMP_AFTER_FRAMES,
  OLLIE_DIVE,
  OLLIE_HEAD_CENTER_PX,
  OLLIE_SIZE_PX,
  OLLIE_HOP_SPRING,
  OLLIE_SPARKLES,
  OLLIE_SQUASH,
  OLLIE_VISIBLE_FROM_PX,
} from "@/constants/ollie";
import type { OllieGuideProps } from "@/types/autopilot-onboarding";

/**
 * Ollie's newest line: the last paragraph of the last reply. While he thinks
 * it's the "Thinking" row under your answer, where his reply will start.
 */
function lastLine(container: HTMLElement, thinking: boolean) {
  if (thinking) {
    const rows = container.querySelectorAll(
      '[data-slot="message-scroller-item"]'
    );
    const row = rows.item(rows.length - 1) as HTMLElement | null;
    if (row && !row.querySelector(".is-user, .is-assistant")) {
      return row;
    }
  }
  const lines = container.querySelectorAll(
    '[data-slot="message-scroller-item"] .is-assistant p'
  );
  return lines.item(lines.length - 1) as HTMLElement | null;
}

function Sparkles({ burst }: { burst: number }) {
  return (
    <AnimatePresence>
      {burst > 0 ? (
        <span aria-hidden="true" className="absolute inset-0" key={burst}>
          {Array.from({ length: OLLIE_SPARKLES.count }, (_, index) => {
            const angle = (index / OLLIE_SPARKLES.count) * Math.PI * 2;
            return (
              <m.span
                animate={{
                  x: Math.cos(angle) * OLLIE_SPARKLES.distance,
                  y: Math.sin(angle) * OLLIE_SPARKLES.distance,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.6],
                }}
                className={cn(
                  "absolute top-1/2 left-1/2 size-1",
                  index % 2 === 0 ? "bg-primary" : "bg-primary/50"
                )}
                initial={{ x: 0, y: 0, opacity: 0 }}
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- a fixed ring of sparkles, never reordered
                key={index}
                transition={{
                  duration: OLLIE_SPARKLES.seconds,
                  ease: "easeOut",
                }}
              />
            );
          })}
        </span>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Ollie beside the chat. He hops along to the line he's saying, squashing
 * and stretching as he moves, and bursts
 * into sparkles once everything is set up.
 */
export function OllieGuide({
  mood,
  containerRef,
  diving = false,
}: OllieGuideProps) {
  const reduceMotion = useReducedMotion() ?? false;
  // Where his line is, followed exactly: scrolling, resizing or a question
  // card sliding in move him with the text, never behind it.
  const pinned = useMotionValue(0);
  // How far he still is from that line, only while he moves to a new one.
  const glide = useSpring(0, reduceMotion ? { duration: 0 } : OLLIE_HOP_SPRING);
  const y = useTransform(() => pinned.get() + glide.get());
  const speed = useVelocity(glide);
  const scaleY = useTransform(
    speed,
    [-OLLIE_SQUASH.speed, 0, OLLIE_SQUASH.speed],
    [OLLIE_SQUASH.stretch, 1, OLLIE_SQUASH.stretch]
  );
  const scaleX = useTransform(
    speed,
    [-OLLIE_SQUASH.speed, 0, OLLIE_SQUASH.speed],
    [OLLIE_SQUASH.squash, 1, OLLIE_SQUASH.squash]
  );
  const [burst, setBurst] = useState(0);
  // The dive: he swims right and down into the dock, then pops.
  const swim = useSpring(0, reduceMotion ? { duration: 0 } : OLLIE_HOP_SPRING);
  const [popped, setPopped] = useState(false);
  const divingRef = useRef(diving);
  const followed = useRef<Element | null | undefined>(undefined);
  const thinking = useRef(false);
  // Frames his line has been below the chat's bottom edge in a row.
  const below = useRef(0);
  // The frame loop reads these; they're kept current after each render.
  useEffect(() => {
    divingRef.current = diving;
    thinking.current = mood === "thinking";
  }, [diving, mood]);

  // Follows the newest line every frame: it moves as it's typed and scrolled.
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      const container = containerRef.current;
      // Hidden on narrow screens (he only shows from @4xl), nothing to follow.
      if (container && container.clientWidth >= OLLIE_VISIBLE_FROM_PX) {
        const box = container.getBoundingClientRect();
        const line = divingRef.current
          ? null
          : lastLine(container, thinking.current);
        const lineBox = line?.getBoundingClientRect();
        const lineHeight = line
          ? Number.parseFloat(getComputedStyle(line).lineHeight) || 20
          : 20;
        let top = lineBox
          ? lineBox.top - box.top + lineHeight / 2 - OLLIE_HEAD_CENTER_PX
          : 24;
        if (divingRef.current) {
          top =
            box.height - OLLIE_DIVE.dockMiddleFromBottom - OLLIE_HEAD_CENTER_PX;
        }
        // He stays inside the chat's scroll area, never over the input.
        const viewport = container.querySelector(
          '[data-slot="message-scroller-viewport"]'
        );
        const lowest =
          (viewport?.getBoundingClientRect().bottom ?? box.bottom) -
          box.top -
          OLLIE_SIZE_PX;
        // When a question card slides in, the chat shrinks a frame before
        // it scrolls the text up; clamping right away would pop him above
        // his line for that frame. Only a line that stays below the edge,
        // like after scrolling up, keeps him above the input.
        below.current = top > lowest ? below.current + 1 : 0;
        const clamped =
          below.current > OLLIE_CLAMP_AFTER_FRAMES
            ? Math.min(top, lowest)
            : top;
        const target = Math.round(
          divingRef.current ? top : Math.max(clamped, 8)
        );
        if (followed.current === undefined) {
          // First sight: a short slide in from above.
          followed.current = line ?? null;
          pinned.set(target);
          glide.jump(-16);
          glide.set(0);
        } else if (line !== followed.current) {
          // A new line: he starts where he is and glides over to it.
          followed.current = line ?? null;
          const from = pinned.get() + glide.get();
          pinned.set(target);
          glide.jump(from - target);
          glide.set(0);
        } else if (target !== pinned.get()) {
          pinned.set(target);
        }
      }
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    return () => window.cancelAnimationFrame(frame);
  }, [containerRef, pinned, glide]);

  useEffect(() => {
    if (mood === "happy" && !reduceMotion) {
      setBurst((current) => current + 1);
    }
  }, [mood, reduceMotion]);

  // Diving: swim over, then pop into sparkles where the dock appears.
  useEffect(() => {
    if (!diving) {
      return;
    }
    swim.set(OLLIE_DIVE.x);
    const id = window.setTimeout(
      () => {
        setPopped(true);
        if (!reduceMotion) {
          setBurst((current) => current + 1);
        }
      },
      reduceMotion ? 0 : AUTOPILOT_ONBOARDING_ENDING.dive * 1000
    );
    return () => window.clearTimeout(id);
  }, [diving, swim, reduceMotion]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden px-4 @4xl/chat:block">
        <div className="relative mx-auto w-full max-w-2xl">
          <m.div
            className="absolute top-0 right-full mr-4 size-10 origin-bottom"
            style={{ x: swim, y, scaleX, scaleY }}
          >
            <m.div
              animate={
                popped
                  ? {
                      opacity: 0,
                      scale: OLLIE_DIVE.shrink,
                      filter: "blur(2px)",
                    }
                  : { opacity: 1, scale: 1, filter: "blur(0px)" }
              }
              className="relative size-10"
              initial={false}
              transition={{ duration: 0.28, ease: "easeIn" }}
            >
              <Ollie className="relative size-10" mood={mood} />
            </m.div>
            <Sparkles burst={burst} />
          </m.div>
        </div>
      </div>
    </LazyMotion>
  );
}
