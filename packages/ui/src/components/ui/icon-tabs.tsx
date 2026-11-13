"use client";

import { ICON_TABS_INDICATOR_MS } from "@notra/ui/constants/icon-tabs";
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

function IconTabsIndicator({ value }: IconTabsIndicatorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<IconTabsIndicatorBox | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const list = element?.parentElement;
    if (!(element && list)) {
      return;
    }

    const from = boxRef.current;
    const animate =
      from !== null &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectStart = performance.now();
    // The slide counts from its first painted frame, so a long render right
    // after the click delays it instead of skipping it.
    let start: number | null = null;
    let frame = 0;

    const nextFrame = () => {
      frame = requestAnimationFrame((now) => {
        start ??= now;
        tick(now);
      });
    };

    const tick = (now: number) => {
      frame = 0;
      const target = measureActiveTab(list);
      if (!target) {
        if (now - effectStart < ICON_TABS_INDICATOR_MS) {
          frame = requestAnimationFrame(tick);
        }
        return;
      }
      const elapsed = start === null ? 0 : Math.max(0, now - start);
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
      boxRef.current = box;
      applyIndicatorBox(element, box);
      element.dataset.ready = "";
      if (progress < 1) {
        nextFrame();
      }
    };
    tick(effectStart);

    const observer = new ResizeObserver(() => {
      if (frame !== 0) {
        return;
      }
      const target = measureActiveTab(list);
      if (target) {
        boxRef.current = target;
        applyIndicatorBox(element, target);
      }
    });
    observer.observe(list);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value]);

  return (
    <span
      aria-hidden="true"
      className="peer/indicator bg-background dark:bg-foreground/10 pointer-events-none absolute top-0 left-0 z-0 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      ref={ref}
    />
  );
}

/** `TabsList` with the sliding indicator. Pair with `IconTabsTrigger`. */
function IconTabsList({ value, children, ...props }: IconTabsListProps) {
  return (
    <TabsList indicator={false} {...props}>
      <IconTabsIndicator value={value} />
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
