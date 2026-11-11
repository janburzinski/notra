export const SELECT_COLLISION_AVOIDANCE = {
  side: "flip",
  align: "shift",
} as const;

/**
 * One spacing scale for every menu surface (dropdown, select, combobox,
 * context menu). The popup sets the sizes as variables so items, labels,
 * indicators and insets line up by construction. `data-size="sm"` matches
 * the `sm` button: 28px rows and 13px text instead of 32px and 14px.
 * The item radius is the popup radius minus its 4px padding.
 */
const MENU_SCALE_CLASS_NAME =
  "[--menu-radius:0.875rem] [--menu-item-height:2rem] [--menu-item-px:0.625rem] [--menu-icon:1rem] [--menu-text:0.875rem] data-[size=sm]:[--menu-radius:0.75rem] data-[size=sm]:[--menu-item-height:1.75rem] data-[size=sm]:[--menu-item-px:0.5rem] data-[size=sm]:[--menu-icon:0.875rem] data-[size=sm]:[--menu-text:0.8125rem] [--menu-indent:calc(var(--menu-item-px)+var(--menu-icon)+0.5rem)]";

export const DROPDOWN_POPUP_CLASS_NAME = `${MENU_SCALE_CLASS_NAME} z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-(--menu-radius) border border-border bg-popover bg-linear-to-b from-background to-[color-mix(in_oklab,var(--color-background),var(--color-foreground)_2.5%)] text-popover-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-8px_rgba(0,0,0,0.16)] outline-none transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [corner-shape:squircle] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.97] motion-safe:data-starting-style:scale-[0.97] motion-reduce:transition-none dark:border-input dark:from-muted dark:to-shell dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.3),0_16px_32px_-8px_rgba(0,0,0,0.6)]`;

export const DROPDOWN_ITEM_CLASS_NAME =
  "relative flex min-h-(--menu-item-height) cursor-pointer select-none items-center gap-2 rounded-[calc(var(--menu-radius)-0.25rem)] px-(--menu-item-px) py-1 text-(length:--menu-text) leading-5 outline-hidden transition-colors duration-75 [corner-shape:squircle] data-[inset]:pl-(--menu-indent) data-highlighted:bg-menu-highlight data-highlighted:text-foreground dark:data-highlighted:shadow-menu-highlight data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 *:[svg]:text-muted-foreground data-highlighted:*:[svg]:text-foreground [&_svg:not([class*='size-'])]:size-(--menu-icon) [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const DROPDOWN_DESTRUCTIVE_ITEM_CLASS_NAME =
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:text-destructive";

/** Check mark on the right of a selectable item; pair with `pr-(--menu-indent)`. */
export const DROPDOWN_INDICATOR_CLASS_NAME =
  "pointer-events-none absolute right-(--menu-item-px) flex size-(--menu-icon) items-center justify-center";

export const DROPDOWN_LABEL_CLASS_NAME =
  "px-(--menu-item-px) pt-1.5 pb-1 font-medium text-muted-foreground text-xs data-[inset]:pl-(--menu-indent)";

export const DROPDOWN_SEPARATOR_CLASS_NAME = "-mx-1 my-1 h-px bg-border";

export const DROPDOWN_SHORTCUT_CLASS_NAME =
  "ml-auto pl-4 font-sans text-muted-foreground/70 text-xs tabular-nums tracking-wider";
