"use client";

import { SidebarRail, useSidebar } from "@notra/ui/components/ui/sidebar";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
} from "react";

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_RESIZE_STEP,
} from "@/constants/nav";
import type { SidebarResizeHandleProps } from "@/types/components/sidebar-resize-handle";
import { clampSidebarWidth } from "@/utils/sidebar-width";

export function SidebarResizeHandle({
  onWidthChange,
  onWidthChangeEnd,
  onWidthChangeStart,
  width,
}: SidebarResizeHandleProps) {
  const { setOpen, state } = useSidebar();
  const draggedRef = useRef(false);
  const currentWidthRef = useRef<number | null>(null);
  const startWidthRef = useRef(0);
  const startXRef = useRef(0);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    },
    [state]
  );

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    draggedRef.current = false;
    currentWidthRef.current = width;
    startWidthRef.current = width;
    startXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
    onWidthChangeStart();
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (currentWidthRef.current === null) {
      return;
    }

    const draggedWidth =
      startWidthRef.current + event.clientX - startXRef.current;
    if (Math.abs(event.clientX - startXRef.current) > 3) {
      draggedRef.current = true;
    }
    if (state === "collapsed") {
      if (event.clientX - startXRef.current >= 40) {
        finishResize(event);
        setOpen(true);
      }
      return;
    }
    const nextWidth = clampSidebarWidth(draggedWidth);
    currentWidthRef.current = nextWidth;
    onWidthChange(nextWidth);
    if (draggedWidth < SIDEBAR_MIN_WIDTH - 40) {
      finishResize(event);
      setOpen(false);
    }
  };

  const finishResize = (event: PointerEvent<HTMLButtonElement>) => {
    const currentWidth = currentWidthRef.current;
    if (currentWidth === null) {
      return;
    }

    currentWidthRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onWidthChangeEnd(currentWidth);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextWidth: number | undefined;

    if (event.key === "ArrowLeft") {
      if (state === "collapsed") {
        return;
      }
      if (width === SIDEBAR_MIN_WIDTH) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      nextWidth = clampSidebarWidth(width - SIDEBAR_RESIZE_STEP);
    } else if (event.key === "ArrowRight") {
      if (state === "collapsed") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      nextWidth = clampSidebarWidth(width + SIDEBAR_RESIZE_STEP);
    } else if (event.key === "Home") {
      nextWidth = SIDEBAR_MIN_WIDTH;
    } else if (event.key === "End") {
      nextWidth = SIDEBAR_MAX_WIDTH;
    }

    if (nextWidth === undefined) {
      return;
    }

    event.preventDefault();
    if (state === "collapsed") {
      setOpen(true);
    }
    onWidthChange(nextWidth);
    onWidthChangeEnd(nextWidth);
  };

  return (
    <SidebarRail
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuemin={0}
      aria-valuenow={state === "collapsed" ? 0 : width}
      aria-valuetext={state === "collapsed" ? "Collapsed" : `${width} pixels`}
      className="touch-none group-data-[collapsible=icon]:-right-5.5! after:hidden max-sm:hidden"
      onClick={(event) => {
        if (event.detail === 0) {
          setOpen(state === "collapsed");
        } else if (!draggedRef.current && event.detail === 1) {
          // Keep the rail under the pointer until a possible double-click.
          clickTimeoutRef.current = window.setTimeout(() => {
            clickTimeoutRef.current = null;
            setOpen(state === "collapsed");
          }, 500);
        }
        draggedRef.current = false;
      }}
      onDoubleClick={() => {
        if (clickTimeoutRef.current !== null) {
          window.clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        setOpen(true);
        onWidthChange(SIDEBAR_DEFAULT_WIDTH);
        onWidthChangeEnd(SIDEBAR_DEFAULT_WIDTH);
      }}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={finishResize}
      onPointerCancel={finishResize}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishResize}
      role="separator"
      tabIndex={0}
      title="Drag to resize or collapse sidebar. Double-click to reset."
    />
  );
}
