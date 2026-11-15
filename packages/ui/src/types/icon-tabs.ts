import type { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

export interface IconTabsIndicatorProps {
  /** Active tab value; a change starts the slide. */
  value: string;
  /** See `IconTabsListProps.indicatorId`. */
  indicatorId?: string;
}

export interface IconTabsIndicatorBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A tab's label and icon x (relative to the list) and icon opacity. */
export interface IconTabsContentPosition {
  label: number;
  glyph: number;
  opacity: number;
}

/** The indicator box and every tab's label and icon, at one moment. */
export interface IconTabsFrame {
  box: IconTabsIndicatorBox;
  content: IconTabsContentPosition[];
}

/**
 * A slide from one frame to another. `animations` run it (the first is the
 * indicator's, the clock); once they are cancelled, `elapsed` says how far it
 * got.
 */
export interface IconTabsMotion {
  from: IconTabsFrame;
  to: IconTabsFrame;
  animations: Animation[];
  elapsed: number;
}

export interface SlideInTabIconProps {
  children: ReactNode;
  /** Keeps the icon visible on inactive tabs, e.g. for a live spinner. */
  pinned?: boolean;
}

export type IconTabsListProps = Omit<TabsPrimitive.List.Props, "children"> & {
  /** Active tab value. Must match the `value` of the surrounding `Tabs`. */
  value: string;
  /**
   * Shares the indicator position between every list with this id, so a list
   * that mounts or is revealed (one copy per route, or kept under Activity)
   * slides from where the previous one stopped instead of appearing in place.
   */
  indicatorId?: string;
  children: ReactNode;
};

export type IconTabsTriggerProps = TabsPrimitive.Tab.Props & {
  /** Shown only on the active tab, sliding in beside the label. */
  icon: ReactNode;
  /** Keeps the icon visible on inactive tabs, e.g. for a live spinner. */
  iconPinned?: boolean;
};
