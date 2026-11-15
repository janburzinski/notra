export const RIGHT_PANEL_PORTAL_ID = "dashboard-right-panel";
export const RIGHT_PANEL_CLASSNAME =
  "hidden min-h-0 min-w-0 shrink-0 overflow-hidden lg:block";
/**
 * The panel slides in like the sidebar: its slot grows with the sidebar's
 * timing while the frame keeps its width, so the page makes room as it
 * moves in and nothing fades.
 */
export const RIGHT_PANEL_SLIDE_CLASSNAME =
  "transition-[width] duration-normal ease-out motion-reduce:transition-none";
export const RIGHT_PANEL_OPEN_WIDTH_CLASSNAME = "w-[calc(24rem+0.5rem+1px)]";
export const RIGHT_PANEL_WIDE_OPEN_WIDTH_CLASSNAME =
  "w-[calc(min(40rem,45vw)+0.5rem+1px)]";
export const RIGHT_PANEL_EXPANDED_WIDTH_CLASSNAME = "min-w-0 flex-1 shrink";
export const RIGHT_PANEL_FRAME_CLASSNAME =
  "my-2 mr-2 ml-px flex h-[calc(100%-1rem)] shrink-0 flex-col rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none";
export const RIGHT_PANEL_SURFACE_CLASSNAMES = {
  muted: "border-sidebar-border bg-muted",
  /** The dualtone shell tables use: content sits on a card with a 2px rim. */
  shell: "border-shell-border bg-shell",
} as const;
/** The white card inside a `shell` panel, framed by a 2px rim. */
export const RIGHT_PANEL_SHELL_CARD_CLASSNAME =
  "mx-0.5 rounded-[10px] border border-table-card-border bg-table-card shadow-table-card";
export const RIGHT_PANEL_FRAME_DOCKED_WIDTH_CLASSNAME = "w-96";
export const RIGHT_PANEL_FRAME_WIDE_DOCKED_WIDTH_CLASSNAME =
  "w-[min(40rem,45vw)]";
export const RIGHT_PANEL_FRAME_EXPANDED_WIDTH_CLASSNAME =
  "min-w-0 w-[calc(100%-0.5rem-1px)]";
