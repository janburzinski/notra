import { cn } from "@notra/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

import {
  CYCLE_CHAR_HIDDEN_ENTER,
  CYCLE_CHAR_HIDDEN_EXIT,
  CYCLE_CHAR_SHOWN,
  CYCLE_LINE_EASING,
  CYCLE_WORD_DURATION_MS,
  CYCLE_WORD_EXIT,
  CYCLE_WORD_FALLBACK_EASING,
  CYCLE_WORD_SPRING_EASING,
  CYCLE_WORD_STAGGER,
} from "@/constants/landing/cycle-text";
import type { CycleLineProps, CycleWordProps } from "@/types/landing/hero";

const PIECE_SELECTOR = "[data-cycle-piece]";

type PiecePositions = Map<HTMLElement, { x: number; y: number }>;

function wordEasing() {
  return CSS.supports("animation-timing-function", CYCLE_WORD_SPRING_EASING)
    ? CYCLE_WORD_SPRING_EASING
    : CYCLE_WORD_FALLBACK_EASING;
}

function sharedPrefixLength(a: string[], b: string[]) {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) {
    length += 1;
  }
  return length;
}

function measurePieces(root: HTMLElement): PiecePositions {
  const positions: PiecePositions = new Map();
  for (const piece of root.querySelectorAll<HTMLElement>(PIECE_SELECTOR)) {
    // Layout offsets ignore transforms, so a running slide never skews them.
    positions.set(piece, { x: piece.offsetLeft, y: piece.offsetTop });
  }
  return positions;
}

/**
 * A line of text around a {@link CycleWord}. When `cycleKey` changes, every
 * `data-cycle-piece` child slides from its old place to its new one with a
 * transform, so the line re-centres without animating layout.
 */
export function CycleLine({
  cycleKey,
  animated,
  className,
  children,
}: CycleLineProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const positions = useRef<PiecePositions>(new Map());
  const lastKey = useRef(cycleKey);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const observer = new ResizeObserver(() => {
      positions.current = measurePieces(root);
    });
    observer.observe(root);
    for (const piece of root.querySelectorAll(PIECE_SELECTOR)) {
      observer.observe(piece);
    }
    return () => observer.disconnect();
  }, [cycleKey]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const before = positions.current;
    const after = measurePieces(root);
    positions.current = after;
    if (!animated || lastKey.current === cycleKey) {
      lastKey.current = cycleKey;
      return;
    }
    lastKey.current = cycleKey;

    for (const [piece, to] of after) {
      const from = before.get(piece);
      if (!from) {
        continue;
      }
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        continue;
      }
      piece.animate(
        { transform: [`translate(${dx}px, ${dy}px)`, "none"] },
        { duration: CYCLE_WORD_DURATION_MS, easing: CYCLE_LINE_EASING }
      );
    }
  }, [animated, cycleKey]);

  return (
    <span className={cn("relative", className)} ref={rootRef}>
      {children}
    </span>
  );
}

/**
 * A word that rolls its characters in and out when `value` changes. Only
 * transform, opacity and filter animate, so the swap stays on the compositor.
 * Characters the old and new word start with stay in place.
 */
export function CycleWord({ value, animated, className }: CycleWordProps) {
  const slotRef = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(value);
  const [ghost, setGhost] = useState<{ text: string; id: number } | null>(null);

  if (value !== current) {
    setCurrent(value);
    setGhost(animated ? { text: current, id: (ghost?.id ?? 0) + 1 } : null);
  }

  const chars = Array.from(current);
  const ghostChars = ghost ? Array.from(ghost.text) : [];
  const shared = ghost ? sharedPrefixLength(ghostChars, chars) : chars.length;

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot || !ghost) {
      return;
    }
    const easing = wordEasing();
    const animate = (selector: string, exit: boolean) => {
      const nodes = slot.querySelectorAll<HTMLElement>(selector);
      // Leaving glyphs clear out faster and from the end, so the text after
      // the word never slides over a glyph that is still readable.
      const duration = CYCLE_WORD_DURATION_MS * (exit ? CYCLE_WORD_EXIT : 1);
      const step =
        nodes.length > 1
          ? (duration * CYCLE_WORD_STAGGER) / (nodes.length - 1)
          : 0;
      return Array.from(nodes, (node, index) =>
        node.animate(
          exit
            ? [CYCLE_CHAR_SHOWN, CYCLE_CHAR_HIDDEN_EXIT]
            : [CYCLE_CHAR_HIDDEN_ENTER, CYCLE_CHAR_SHOWN],
          {
            duration,
            delay: (exit ? nodes.length - 1 - index : index) * step,
            easing: exit ? CYCLE_WORD_FALLBACK_EASING : easing,
            // Exits hold their end state until React drops the ghost.
            fill: exit ? "both" : "backwards",
          }
        )
      );
    };
    animate("[data-cycle-enter]", false);
    const exits = animate("[data-cycle-exit]", true);
    let active = true;
    Promise.all(exits.map((animation) => animation.finished))
      .then(() => {
        if (active) {
          setGhost(null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ghost]);

  return (
    <span
      className={cn(
        "relative inline-block whitespace-nowrap [font-kerning:none] [font-variant-ligatures:none]",
        className
      )}
      data-cycle-piece=""
      ref={slotRef}
    >
      {chars.map((char, index) => (
        <span
          className="inline-block whitespace-pre"
          data-cycle-enter={index >= shared ? "" : undefined}
          key={`${index}:${char}`}
        >
          {char}
        </span>
      ))}
      {ghost ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0"
          key={ghost.id}
        >
          {ghostChars.map((char, index) => (
            <span
              className={cn(
                "inline-block whitespace-pre",
                index < shared && "invisible"
              )}
              data-cycle-exit={index >= shared ? "" : undefined}
              key={index}
            >
              {char}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
