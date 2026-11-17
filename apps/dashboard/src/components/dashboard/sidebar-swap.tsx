"use client";

import { cn } from "@notra/ui/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  SIDEBAR_MODE_PANEL_CLASS,
  SIDEBAR_SWAP_MOTION,
  SIDEBAR_SWAP_PRE_TRADE_HOLD_MS,
  SIDEBAR_SWAP_STALE_FRAME_MS,
} from "@/constants/nav";
import type {
  SidebarSwapItem,
  SidebarSwapMotion,
  SidebarSwapProps,
  SidebarSwapSide,
} from "@/types/components/nav";
import { findVerticalScrollParent } from "@/utils/scroll-parent";

const USER_SCROLL_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"];

interface PushScrollPlan {
  scroller: HTMLElement;
  leavingId: string;
  enteringId: string;
  /** Offset that keeps the leaving panel in place as the scroll moves. */
  leavingTop: number;
  scrollTop: number;
}

function panelClassName(
  shown: boolean,
  side: SidebarSwapSide,
  motion: SidebarSwapMotion,
  className?: string
) {
  const config = SIDEBAR_SWAP_MOTION[motion];
  const exitClass =
    side === "left" ? config.exitLeftClass : config.exitRightClass;

  return cn(
    SIDEBAR_MODE_PANEL_CLASS,
    shown
      ? `relative ${config.enterClass}`
      : `absolute inset-x-0 top-0 ${exitClass}`,
    className
  );
}

function SidebarSwapLayer({
  id,
  active,
  shown,
  side,
  motion,
  className,
  children,
}: {
  id: string;
  /** The panel the swap is heading to; it takes input before it shows. */
  active: boolean;
  shown: boolean;
  side: SidebarSwapSide;
  motion: SidebarSwapMotion;
  className?: string;
  children: SidebarSwapItem["children"];
}) {
  return (
    <div
      aria-hidden={!active}
      className={panelClassName(shown, side, motion, className)}
      data-swap-id={id}
      inert={active ? undefined : true}
    >
      {children}
    </div>
  );
}

function swapPanel(root: HTMLElement, id: string) {
  return [...root.children].find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.swapId === id
  );
}

/**
 * A push opens the next panel at its top, like a new page. Taking the leaving
 * panel out of flow would clamp the scroll position and jerk it upward, so it
 * is pinned where it was and the scroll resets under it. This measures while
 * the leaving panel is still in flow.
 */
function measurePushScroll(
  root: HTMLElement,
  leavingId: string,
  enteringId: string
): PushScrollPlan | null {
  const scroller = findVerticalScrollParent(root);
  if (!scroller) {
    return null;
  }
  // An interrupted push brings back a panel that is still pinned; it gets its
  // scroll position back.
  const enteringTop = swapPanel(root, enteringId)?.style.top;
  const enteringOffset = -Number.parseFloat(enteringTop || "0");
  const scrolledPast = Math.max(
    0,
    scroller.getBoundingClientRect().top - root.getBoundingClientRect().top
  );
  // The scroll moves by `enteringOffset - scrolledPast`, and the leaving
  // panel moves the other way by as much so it stays where it was.
  return {
    scroller,
    leavingId,
    enteringId,
    leavingTop: enteringOffset - scrolledPast,
    scrollTop: scroller.scrollTop - scrolledPast + enteringOffset,
  };
}

/** Applies a plan once the panels have traded places; returns its release. */
function applyPushScroll(root: HTMLElement, plan: PushScrollPlan) {
  const { scroller, leavingTop, scrollTop } = plan;
  const entering = swapPanel(root, plan.enteringId);
  const leaving = swapPanel(root, plan.leavingId);
  if (entering) {
    entering.style.top = "";
  }
  if (leaving) {
    leaving.style.top = leavingTop === 0 ? "" : `${leavingTop}px`;
  }
  scroller.scrollTop = scrollTop;
  return holdScroll(scroller, scrollTop, SIDEBAR_SWAP_MOTION.push.exitMs);
}

/**
 * The router restores scroll positions after a route renders, which would
 * move the panels mid-swap. Keeps the scroll at `scrollTop` until `ms` pass or
 * the user scrolls; returns the release.
 */
function holdScroll(scroller: HTMLElement, scrollTop: number, ms: number) {
  const hold = () => {
    if (scroller.scrollTop !== scrollTop) {
      scroller.scrollTop = scrollTop;
    }
  };
  const release = () => {
    window.clearTimeout(timeout);
    scroller.removeEventListener("scroll", hold);
    for (const type of USER_SCROLL_INPUT) {
      window.removeEventListener(type, release, { capture: true });
    }
  };
  scroller.addEventListener("scroll", hold);
  for (const type of USER_SCROLL_INPUT) {
    window.addEventListener(type, release, { capture: true, once: true });
  }
  const timeout = window.setTimeout(release, ms);
  return release;
}

export function SidebarSwap({
  activeId,
  items,
  keepMounted = false,
  motion = "fade",
  className,
}: SidebarSwapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  // The panel showing on screen. It trails `activeId`: the new panel mounts in
  // its start position, and the panels trade places at the start of the next
  // frame. The trade is written to the DOM right there and React catches up
  // with the same classes afterwards. Letting React commit it instead could
  // land it after leftover work from the route change, and a transition that
  // starts late in a long task opens part-way through.
  const [shownId, setShownId] = useState(activeId);
  const [leavingIds, setLeavingIds] = useState<readonly string[]>([]);
  const leaveTimeoutsRef = useRef(new Map<string, number>());
  const releaseScrollRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    itemsRef.current = items;
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (activeId === shownId || !root) {
      return;
    }
    // Keeps the panel on screen where it is until the trade below measures it.
    const scroller = motion === "push" ? findVerticalScrollParent(root) : null;
    if (scroller) {
      releaseScrollRef.current?.();
      releaseScrollRef.current = holdScroll(
        scroller,
        scroller.scrollTop,
        SIDEBAR_SWAP_PRE_TRADE_HOLD_MS
      );
    }
    let frame = 0;
    const trade = (frameTime: number) => {
      // A frame that was due during a long task runs late with its old time,
      // and a transition started in it would open part-way through.
      if (performance.now() - frameTime > SIDEBAR_SWAP_STALE_FRAME_MS) {
        frame = requestAnimationFrame(trade);
        return;
      }
      // Styles the new panel in its start position so the trade transitions
      // from there.
      root.getBoundingClientRect();
      const plan =
        motion === "push" ? measurePushScroll(root, shownId, activeId) : null;
      for (const item of itemsRef.current) {
        const panel = swapPanel(root, item.id);
        if (panel) {
          panel.className = panelClassName(
            item.id === activeId,
            item.side,
            motion,
            item.className
          );
        }
      }
      if (plan) {
        releaseScrollRef.current?.();
        releaseScrollRef.current = applyPushScroll(root, plan);
      }

      const timeouts = leaveTimeoutsRef.current;
      window.clearTimeout(timeouts.get(activeId));
      timeouts.delete(activeId);
      window.clearTimeout(timeouts.get(shownId));
      timeouts.set(
        shownId,
        window.setTimeout(() => {
          timeouts.delete(shownId);
          setLeavingIds((ids) => ids.filter((id) => id !== shownId));
        }, SIDEBAR_SWAP_MOTION[motion].exitMs)
      );
      setShownId(activeId);
      setLeavingIds((ids) => [
        ...ids.filter((id) => id !== activeId && id !== shownId),
        shownId,
      ]);
    };
    frame = requestAnimationFrame(trade);
    return () => cancelAnimationFrame(frame);
  }, [activeId, shownId, motion]);

  useEffect(() => {
    const timeouts = leaveTimeoutsRef.current;
    return () => {
      releaseScrollRef.current?.();
      for (const timeout of timeouts.values()) {
        window.clearTimeout(timeout);
      }
    };
  }, []);

  const leaving = new Set(leavingIds);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      {items.map((item) => {
        const mounted =
          keepMounted ||
          item.id === activeId ||
          item.id === shownId ||
          leaving.has(item.id);
        if (!mounted) {
          return null;
        }

        return (
          <SidebarSwapLayer
            active={item.id === activeId}
            className={item.className}
            id={item.id}
            key={item.id}
            motion={motion}
            shown={item.id === shownId}
            side={item.side}
          >
            {item.children}
          </SidebarSwapLayer>
        );
      })}
    </div>
  );
}
