export const COMPOSER_TRAY_TRANSITION =
  "transition-[background-color,padding] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none";

/** Follows the nudge's height so the input card never snaps. */
export const COMPOSER_NUDGE_TRANSITION = {
  duration: 0.3,
  ease: [0.65, 0, 0.35, 1],
} as const;

// Resets the Textarea's field chrome: the composer card is the field.
export const COMPOSER_INPUT =
  "block max-h-50 min-h-12 min-w-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-2 text-foreground text-sm leading-6 caret-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent md:text-sm dark:bg-transparent dark:disabled:bg-transparent";

// The registry Button only dims natively disabled buttons, so focusable
// disabled ones (tooltip triggers) get the same look here.
export const COMPOSER_TOOLBAR_BUTTON =
  "rounded-md text-muted-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50";

export const COMPOSER_TOOLBAR_BUTTON_LABEL = "px-2 text-sm";

// Ghost Button turned into the filled square send action.
export const COMPOSER_SEND_BUTTON =
  "size-8 rounded-[10px] active:scale-[0.96] data-disabled:opacity-100";

export const COMPOSER_SEND_ACTIVE =
  "bg-foreground text-background hover:bg-foreground/85 hover:text-background dark:hover:bg-foreground/85";

export const COMPOSER_SEND_INERT =
  "bg-foreground/[0.08] text-muted-foreground/70 hover:bg-foreground/[0.08] hover:text-muted-foreground/70 dark:hover:bg-foreground/[0.08] data-disabled:cursor-default";

export const COMPOSER_CHIP_ACTION =
  "size-4 rounded text-muted-foreground hover:bg-accent";
