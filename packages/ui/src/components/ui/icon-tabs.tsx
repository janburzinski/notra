"use client";

import {
  ICON_TABS_ICON_FADE_IN,
  ICON_TABS_ICON_FADE_OUT,
  ICON_TABS_INDICATOR_MS,
} from "@notra/ui/constants/icon-tabs";
import {
  applyIndicatorBox,
  easeOutQuint,
  glyphRestLeft,
  iconOpacity,
  iconTabsEasing,
  indicatorTransform,
  measureActiveTab,
  measureTabContent,
  mixFrames,
  tabContentElements,
} from "@notra/ui/lib/icon-tabs";
import { cn } from "@notra/ui/lib/utils";
import type {
  SlideInTabIconProps,
  IconTabsFrame,
  IconTabsIndicatorBox,
  IconTabsIndicatorProps,
  IconTabsListProps,
  IconTabsMotion,
  IconTabsTriggerProps,
} from "@notra/ui/types/icon-tabs";
import { useLayoutEffect, useRef } from "react";

import { TabsList, TabsTrigger } from "./tabs";

/**
 * Icon that only shows on the active tab, so inactive tabs stay text-only.
 * Its slot snaps open (width never animates); `IconTabsIndicator` slides the
 * labels and fades the icon in step with the indicator instead. `pinned`
 * keeps it visible anyway, e.g. for a live scan spinner.
 */
function SlideInTabIcon({ children, pinned = false }: SlideInTabIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "-me-1.5 flex w-0 shrink-0 items-center justify-start group-data-active/tab:me-0 group-data-active/tab:w-4",
        pinned && "me-0 w-4"
      )}
    >
      <span
        className={cn(
          // Web Animations move and fade it. Under reduced motion the global
          // fade still applies, but only to an icon appearing: one leaving
          // already sits under its label, so it goes at once.
          "flex shrink-0 scale-90 items-center opacity-0 group-data-active/tab:scale-100 group-data-active/tab:opacity-100 motion-reduce:transition-none! motion-reduce:group-data-active/tab:transition-opacity!",
          pinned && "scale-100 opacity-100"
        )}
        data-pinned={pinned ? "" : undefined}
        data-slot="icon-tab-glyph"
      >
        {children}
      </span>
    </span>
  );
}

// Latest slide per `indicatorId`, and when its list stopped showing it (null
// while it still does), shared across list instances.
const sharedMotions = new Map<
  string,
  { motion: IconTabsMotion; releasedAt: number | null }
>();

/** The slide a newly shown list continues, if another just handed it over. */
function takeSharedMotion(indicatorId: string | undefined) {
  const shared = indicatorId ? sharedMotions.get(indicatorId) : null;
  if (!shared) {
    return null;
  }
  if (shared.releasedAt === null) {
    return { motion: shared.motion, sinceRelease: 0 };
  }
  const sinceRelease = performance.now() - shared.releasedAt;
  // Coming back to the page later starts in place rather than sliding from
  // wherever the indicator was last time.
  return sinceRelease < ICON_TABS_INDICATOR_MS
    ? { motion: shared.motion, sinceRelease }
    : null;
}

function motionElapsed(motion: IconTabsMotion): number {
  const time = motion.animations[0]?.currentTime;
  return typeof time === "number" ? time : motion.elapsed;
}

/** What the slide shows right now. */
function shownFrame(motion: IconTabsMotion): IconTabsFrame {
  const progress = Math.min(1, motionElapsed(motion) / ICON_TABS_INDICATOR_MS);
  return mixFrames(motion.from, motion.to, easeOutQuint(progress));
}

function sameBox(a: IconTabsIndicatorBox, b: IconTabsIndicatorBox) {
  return (
    Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5
  );
}

/**
 * Plays the slide as Web Animations on transform and opacity only, so the
 * compositor runs it even while the main thread renders the newly shown
 * page. The indicator scales instead of resizing for the same reason. Each
 * keyframe ends on the element's resting style, so nothing is left behind.
 */
function playMotion(
  indicator: HTMLElement,
  list: HTMLElement,
  from: IconTabsFrame,
  to: IconTabsFrame
): Animation[] {
  const options: KeyframeAnimationOptions = {
    duration: ICON_TABS_INDICATOR_MS,
    easing: iconTabsEasing(),
  };
  const animations = [
    indicator.animate(
      [
        {
          transform: indicatorTransform(
            { ...from.box, top: to.box.top },
            from.box.width / to.box.width
          ),
        },
        { transform: indicatorTransform(to.box) },
      ],
      options
    ),
  ];
  if (from.content.length !== to.content.length) {
    return animations;
  }
  const elements = tabContentElements(list);
  to.content.forEach((target, index) => {
    const start = from.content[index];
    const { tab, label, glyph } = elements[index] ?? {};
    if (!(start && tab)) {
      return;
    }
    const labelShift = start.label - target.label;
    if (label && Math.abs(labelShift) > 0.5) {
      animations.push(
        label.animate(
          [{ translate: `${labelShift}px 0` }, { translate: "0 0" }],
          options
        )
      );
    }
    if (!glyph || (start.opacity === 0 && target.opacity === 0)) {
      return;
    }
    // Offsets from where the icon rests. A closed slot rests it under its
    // label, but it only gets there once faded out, so that never shows.
    const rest = glyphRestLeft(tab, glyph);
    const fromShift = start.glyph - rest;
    const toShift = target.glyph - rest;
    if (
      Math.abs(fromShift - toShift) > 0.5 ||
      start.opacity !== target.opacity
    ) {
      const at = (offset: number) => {
        const opacity = iconOpacity(start, target, offset);
        return {
          offset,
          translate: `${fromShift + (toShift - fromShift) * offset}px 0`,
          opacity,
          scale: 0.9 + 0.1 * opacity,
        };
      };
      // Offsets are eased progress (the curve is on the whole effect), so
      // the keyframes trace `iconOpacity` exactly.
      let keyframes = [at(0), at(1)];
      if (target.opacity < start.opacity) {
        keyframes = [at(0), at(ICON_TABS_ICON_FADE_OUT), at(1)];
      } else if (Math.abs(start.glyph - target.glyph) > 0.5) {
        keyframes = [at(0), at(ICON_TABS_ICON_FADE_IN), at(1)];
      }
      animations.push(glyph.animate(keyframes, options));
    }
  });
  return animations;
}

function IconTabsIndicator({ value, indicatorId }: IconTabsIndicatorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionRef = useRef<IconTabsMotion | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const list = element?.parentElement;
    if (!(element && list)) {
      return;
    }

    const handedOver = takeSharedMotion(indicatorId);
    const previous = handedOver?.motion ?? motionRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let motion: IconTabsMotion | null = null;
    let frame = 0;
    let disposed = false;

    const remember = (next: IconTabsMotion, releasedAt: number | null) => {
      motion = next;
      motionRef.current = next;
      if (indicatorId) {
        sharedMotions.set(indicatorId, { motion: next, releasedAt });
      }
    };

    /** Rests the indicator on the active tab as the layout is now. */
    const settle = () => {
      const box = measureActiveTab(list);
      if (!box) {
        return;
      }
      applyIndicatorBox(element, box);
      const to = { box, content: measureTabContent(list) };
      remember({ from: to, to, animations: [], elapsed: 0 }, null);
    };

    const start = (attempt: number) => {
      const box = measureActiveTab(list);
      if (!box) {
        // The active tab can be marked a frame after this effect runs, so
        // look again for about 200 ms.
        if (attempt < 12) {
          frame = requestAnimationFrame(() => start(attempt + 1));
        }
        return;
      }
      const to = { box, content: measureTabContent(list) };
      applyIndicatorBox(element, box);
      element.dataset.ready = "";
      const resting = { from: to, to, animations: [], elapsed: 0 };
      if (!previous || reduceMotion) {
        remember(resting, null);
        return;
      }
      // A list taking over a slide that is still heading here (another
      // copy of it, one per route) continues it on the same clock.
      const elapsed = motionElapsed(previous) + (handedOver?.sinceRelease ?? 0);
      const resume =
        elapsed < ICON_TABS_INDICATOR_MS && sameBox(previous.to.box, box);
      const from = resume ? previous.from : shownFrame(previous);
      if (!resume && sameBox(from.box, box)) {
        remember(resting, null);
        return;
      }
      // Its own layer only while it slides, set before the first frame so
      // the compositor never shows it on the old layer and the new at once.
      element.style.willChange = "transform";
      const animations = playMotion(element, list, from, to);
      const startAt = resume ? elapsed : 0;
      // Hold the first frame and start the clock on the next frame that
      // actually paints. The page often keeps rendering after this effect
      // (a transition, a revealed route), and a clock started now would
      // skip that part of the slide, landing it halfway in one frame.
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = startAt;
      }
      frame = requestAnimationFrame(() => {
        for (const animation of animations) {
          animation.play();
        }
      });
      remember({ from, to, animations, elapsed: startAt }, null);
      Promise.all(animations.map((animation) => animation.finished)).then(
        () => {
          if (disposed) {
            return;
          }
          element.style.willChange = "";
          // A resize during the slide (a badge loading in) was skipped.
          settle();
        },
        // Cancelled by the next switch or unmount, which takes over.
        () => undefined
      );
    };
    start(0);

    const observer = new ResizeObserver(() => {
      const playing = motion?.animations.some(
        (animation) =>
          animation.playState === "running" || animation.playState === "paused"
      );
      if (!playing) {
        settle();
      }
    });
    observer.observe(list);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.style.willChange = "";
      const current: IconTabsMotion | null = motion;
      if (!current) {
        return;
      }
      const elapsed = motionElapsed(current);
      for (const animation of current.animations) {
        animation.cancel();
      }
      remember(
        { ...current, animations: [], elapsed },
        indicatorId ? performance.now() : null
      );
    };
  }, [value, indicatorId]);

  return (
    <span
      aria-hidden="true"
      className="peer/indicator bg-background dark:bg-foreground/10 pointer-events-none absolute top-0 left-0 z-0 origin-top-left rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      ref={ref}
    />
  );
}

/** `TabsList` with the sliding indicator. Pair with `IconTabsTrigger`. */
function IconTabsList({
  value,
  indicatorId,
  children,
  ...props
}: IconTabsListProps) {
  return (
    <TabsList indicator={false} {...props}>
      <IconTabsIndicator indicatorId={indicatorId} value={value} />
      {children}
    </TabsList>
  );
}

/** `TabsTrigger` whose icon only shows while it is active. */
function IconTabsTrigger({
  icon,
  iconPinned,
  className,
  children,
  ...props
}: IconTabsTriggerProps) {
  return (
    <TabsTrigger
      className={cn(
        // Only the text colour transitions: the fallback background below
        // stands in for the indicator until it has measured, which happens
        // in the same frame, so fading it out would leave a second pill.
        "transition-[color] motion-reduce:transition-[color]! group/tab peer-not-data-ready/indicator:data-active:bg-background dark:peer-not-data-ready/indicator:data-active:bg-foreground/10 peer-not-data-ready/indicator:data-active:shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    >
      <SlideInTabIcon pinned={iconPinned}>{icon}</SlideInTabIcon>
      <span
        className="inline-flex items-center gap-1.5"
        data-slot="icon-tab-label"
      >
        {children}
      </span>
    </TabsTrigger>
  );
}

export { IconTabsList, IconTabsTrigger };
