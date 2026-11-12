"use client";

import { cn } from "@notra/ui/lib/utils";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { RightPanelPortal } from "@/components/dashboard/right-panel-portal";
import {
  RIGHT_PANEL_CLASSNAME,
  RIGHT_PANEL_SLOT_CLOSE_CLASSNAME,
  RIGHT_PANEL_EXPANDED_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_CLASSNAME,
  RIGHT_PANEL_FRAME_DOCKED_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_EXPANDED_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_MOTION_CLASSNAME,
  RIGHT_PANEL_OPEN_WIDTH_CLASSNAME,
  RIGHT_PANEL_FRAME_WIDE_DOCKED_WIDTH_CLASSNAME,
  RIGHT_PANEL_WIDE_OPEN_WIDTH_CLASSNAME,
} from "@/constants/right-panel";
import { useRightPanelSkipMotion } from "@/lib/hooks/use-right-panel-slide";
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
}: RightPanelProps) {
  const wide = size === "wide";
  const { active, expanded, hasOpened } = useRightPanel();
  const open = active === id;
  const skipMotion = useRightPanelSkipMotion(
    open,
    expanded,
    active !== null && !open
  );

  return (
    <RightPanelPortal>
      <aside
        aria-hidden={!open}
        data-closed={open ? undefined : ""}
        className={cn(
          RIGHT_PANEL_CLASSNAME,
          open && "overflow-visible",
          !(open || skipMotion) && RIGHT_PANEL_SLOT_CLOSE_CLASSNAME,
          panelWidthClass(open, expanded, wide)
        )}
        inert={open ? undefined : true}
      >
        {hasOpened[id] ? (
          <div
            className={cn(
              RIGHT_PANEL_FRAME_CLASSNAME,
              RIGHT_PANEL_FRAME_MOTION_CLASSNAME,
              skipMotion && "transition-none",
              !open && "translate-x-4 opacity-0",
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
