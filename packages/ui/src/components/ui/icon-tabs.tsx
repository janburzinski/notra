"use client";

import {
  ICON_TABS_INDICATOR_MS,
  ICON_TABS_MAX_FRAME_STEP_MS,
} from "@notra/ui/constants/icon-tabs";
import {
  applyIndicatorBox,
  easeOutQuint,
  measureActiveTab,
} from "@notra/ui/lib/icon-tabs";
import { cn } from "@notra/ui/lib/utils";
import type {
  SlideInTabIconProps,
  IconTabsIndicatorBox,
  IconTabsIndicatorProps,
  IconTabsListProps,
  IconTabsTriggerProps,
} from "@notra/ui/types/icon-tabs";
import { useLayoutEffect, useRef } from "react";

import { TabsList, TabsTrigger } from "./tabs";

/**
 * Icon that only shows on the active tab: its slot snaps open beside the
 * label while the glyph fades and scales in, so inactive tabs stay text-only.
 * `pinned` keeps it visible anyway, e.g. for a live scan spinner.
 */
function SlideInTabIcon({ children, pinned = false }: SlideInTabIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "-me-1.5 flex w-0 shrink-0 items-center justify-center overflow-hidden group-data-active/tab:me-0 group-data-active/tab:w-4",
        pinned && "me-0 w-4"
      )}
    >
      <span
        className={cn(
          "flex scale-90 items-center opacity-0 transition-[opacity,scale] duration-normal ease-out group-data-active/tab:scale-100 group-data-active/tab:opacity-100",
          pinned && "scale-100 opacity-100"
        )}
      >
        {children}
      </span>
    </span>
  );
}

// Last painted box per `indicatorId`, and when its list stopped painting
// (null while it still does), shared across list instances.
const sharedIndicatorBoxes = new Map<
  string,
  { box: IconTabsIndicatorBox; releasedAt: number | null }
>();

/** The box a newly shown list slides from, if another just handed it over. */
function takeSharedBox(indicatorId: string | undefined) {
  const shared = indicatorId ? sharedIndicatorBoxes.get(indicatorId) : null;
  if (!shared) {
    return null;
  }
  // Coming back to the page later starts in place rather than sliding from
  // wherever the indicator was last time.
  const fresh =
    shared.releasedAt === null ||
    performance.now() - shared.releasedAt < ICON_TABS_INDICATOR_MS;
  return fresh ? shared.box : null;
}

function IconTabsIndicator({ value, indicatorId }: IconTabsIndicatorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<IconTabsIndicatorBox | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const list = element?.parentElement;
    if (!(element && list)) {
      return;
    }

    const from = takeSharedBox(indicatorId) ?? boxRef.current;
    const paint = (box: IconTabsIndicatorBox) => {
      boxRef.current = box;
      if (indicatorId) {
        sharedIndicatorBoxes.set(indicatorId, { box, releasedAt: null });
      }
      applyIndicatorBox(element, box);
    };
    const animate =
      from !== null &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectStart = performance.now();
    // Time is counted per painted frame with a capped step, using
    // performance.now() rather than the rAF timestamp: the first frame after
    // the long task that mounts a page carries a timestamp from before it,
    // which used to land the slide in one jump.
    let elapsed = 0;
    let lastFrame: number | null = null;
    let frame = 0;

    const nextFrame = () => {
      frame = requestAnimationFrame(() => {
        const now = performance.now();
        if (lastFrame !== null) {
          elapsed += Math.min(now - lastFrame, ICON_TABS_MAX_FRAME_STEP_MS);
        }
        lastFrame = now;
        tick();
      });
    };

    const tick = () => {
      frame = 0;
      const target = measureActiveTab(list);
      if (!target) {
        if (performance.now() - effectStart < ICON_TABS_INDICATOR_MS) {
          frame = requestAnimationFrame(tick);
        }
        return;
      }
      const progress = animate
        ? Math.min(1, elapsed / ICON_TABS_INDICATOR_MS)
        : 1;
      const eased = easeOutQuint(progress);
      const box =
        from && progress < 1
          ? {
              left: from.left + (target.left - from.left) * eased,
              top: target.top,
              width: from.width + (target.width - from.width) * eased,
              height: target.height,
            }
          : target;
      paint(box);
      element.dataset.ready = "";
      if (progress < 1) {
        nextFrame();
      }
    };
    tick();

    const observer = new ResizeObserver(() => {
      if (frame !== 0) {
        return;
      }
      const target = measureActiveTab(list);
      if (target) {
        paint(target);
      }
    });
    observer.observe(list);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      const box = boxRef.current;
      if (indicatorId && box) {
        sharedIndicatorBoxes.set(indicatorId, {
          box,
          releasedAt: performance.now(),
        });
      }
    };
  }, [value, indicatorId]);

  return (
    <span
      aria-hidden="true"
      className="peer/indicator bg-background dark:bg-foreground/10 pointer-events-none absolute top-0 left-0 z-0 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
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

/** `TabsTrigger` whose icon only shows, and fades in, while it is active. */
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
        "group/tab peer-not-data-ready/indicator:data-active:bg-background dark:peer-not-data-ready/indicator:data-active:bg-foreground/10 peer-not-data-ready/indicator:data-active:shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    >
      <SlideInTabIcon pinned={iconPinned}>{icon}</SlideInTabIcon>
      {children}
    </TabsTrigger>
  );
}

export { IconTabsList, IconTabsTrigger };
