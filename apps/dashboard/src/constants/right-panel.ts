export const RIGHT_PANEL_PORTAL_ID = "dashboard-right-panel";
export const RIGHT_PANEL_CLASSNAME =
  "hidden min-h-0 min-w-0 shrink-0 overflow-hidden lg:block";
export const RIGHT_PANEL_FRAME_MOTION_CLASSNAME =
  "transition-[translate,opacity] duration-normal ease-out motion-reduce:transition-none starting:translate-x-4 starting:opacity-0";
export const RIGHT_PANEL_OPEN_WIDTH_CLASSNAME = "w-[calc(24rem+0.5rem+1px)]";
export const RIGHT_PANEL_WIDE_OPEN_WIDTH_CLASSNAME =
  "w-[calc(min(40rem,45vw)+0.5rem+1px)]";
export const RIGHT_PANEL_EXPANDED_WIDTH_CLASSNAME = "min-w-0 flex-1 shrink";
export const RIGHT_PANEL_FRAME_CLASSNAME =
  "my-2 mr-2 ml-px flex h-[calc(100%-1rem)] shrink-0 flex-col rounded-xl border border-sidebar-border bg-muted shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none";
export const RIGHT_PANEL_FRAME_DOCKED_WIDTH_CLASSNAME = "w-96";
export const RIGHT_PANEL_FRAME_WIDE_DOCKED_WIDTH_CLASSNAME =
  "w-[min(40rem,45vw)]";
export const RIGHT_PANEL_FRAME_EXPANDED_WIDTH_CLASSNAME =
  "min-w-0 w-[calc(100%-0.5rem-1px)]";
/**
 * On close the slot keeps its width until the frame has faded out (200ms),
 * then snaps to 0: a zero-length width transition with a delay, so the
 * width never animates through in-between values.
 */
export const RIGHT_PANEL_SLOT_CLOSE_CLASSNAME =
  "transition-[width] duration-0 delay-200 motion-reduce:delay-0";
