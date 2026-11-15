"use client";

import { cn } from "@notra/ui/lib/utils";
import { useEffect, useEffectEvent, useRef } from "react";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { RightPanelPortal } from "@/components/dashboard/right-panel-portal";
import {
  RIGHT_PANEL_CLASSNAME,
  RIGHT_PANEL_EXPANDED_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_CLASSNAME,
  RIGHT_PANEL_SURFACE_CLASSNAMES,
  RIGHT_PANEL_FRAME_DOCKED_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_EXPANDED_WIDTH_CLASSNAME,
  RIGHT_PANEL_OPEN_WIDTH_CLASSNAME,
  RIGHT_PANEL_SLIDE_CLASSNAME,
  RIGHT_PANEL_FRAME_WIDE_DOCKED_WIDTH_CLASSNAME,
  RIGHT_PANEL_WIDE_OPEN_WIDTH_CLASSNAME,
} from "@/constants/right-panel";
import type { RightPanelProps } from "@/types/components/right-panel";

function panelWidthClass(open: boolean, expanded: boolean, wide: boolean) {
  if (!open) {
    return "w-0";
  }
  if (expanded) {
    return RIGHT_PANEL_EXPANDED_WIDTH_CLASSNAME;
  }
  return wide
    ? RIGHT_PANEL_WIDE_OPEN_WIDTH_CLASSNAME
    : RIGHT_PANEL_OPEN_WIDTH_CLASSNAME;
}

function frameDockedWidthClass(wide: boolean) {
  return wide
    ? RIGHT_PANEL_FRAME_WIDE_DOCKED_WIDTH_CLASSNAME
    : RIGHT_PANEL_FRAME_DOCKED_WIDTH_CLASSNAME;
}

export function RightPanel({
  id,
  children,
  size = "default",
  surface = "muted",
}: RightPanelProps) {
  const wide = size === "wide";
  const { active, closePanel, expanded, hasOpened } = useRightPanel();
  const open = active === id;
  // Expanding, or switching to another panel, swaps in place.
  const instant = expanded || (active !== null && !open);
  const asideRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Escape inside the panel closes it and puts focus back where it was
  // before it entered the panel. Listened for on the document so anything
  // inside that handles Escape itself (a menu, the composer) goes first. An
  // expanded panel docks first; the panel state's own listener does that.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const aside = asideRef.current;
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      expanded ||
      event.isComposing ||
      !(aside && event.target instanceof Node && aside.contains(event.target))
    ) {
      return;
    }
    event.preventDefault();
    closePanel(id);
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (back?.isConnected) {
      back.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    const aside = asideRef.current;
    if (!(open && aside)) {
      return;
    }
    const onFocusIn = (event: FocusEvent) => {
      const from = event.relatedTarget;
      if (from instanceof HTMLElement && !aside.contains(from)) {
        returnFocusRef.current = from;
      }
    };
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    aside.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", listener);
    return () => {
      aside.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", listener);
    };
  }, [open]);

  return (
    <RightPanelPortal>
      <aside
        aria-hidden={!open}
        data-closed={open ? undefined : ""}
        className={cn(
          RIGHT_PANEL_CLASSNAME,
          !instant && RIGHT_PANEL_SLIDE_CLASSNAME,
          panelWidthClass(open, expanded, wide)
        )}
        inert={open ? undefined : true}
        ref={asideRef}
      >
        {hasOpened[id] ? (
          <div
            className={cn(
              RIGHT_PANEL_FRAME_CLASSNAME,
              RIGHT_PANEL_SURFACE_CLASSNAMES[surface],
              expanded
                ? RIGHT_PANEL_FRAME_EXPANDED_WIDTH_CLASSNAME
                : frameDockedWidthClass(wide)
            )}
          >
            <div className="flex h-full min-h-0 flex-col">{children}</div>
          </div>
        ) : null}
      </aside>
    </RightPanelPortal>
  );
}
