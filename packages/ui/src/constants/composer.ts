export const COMPOSER_TRAY_TRANSITION =
  "transition-[background-color,padding] duration-slow ease-emphasized-in-out motion-reduce:transition-none";

export const COMPOSER_INPUT =
  "block max-h-50 min-h-12 min-w-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-2 text-foreground text-sm leading-6 caret-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent md:text-sm dark:bg-transparent dark:disabled:bg-transparent";

/** The pill's one-line input: it grows with its text, up to a few lines. */
export const COMPOSER_INPUT_PILL =
  "field-sizing-content max-h-40 min-h-8 w-full px-1.5 py-1";

/** The pill's corners, which an open dock around it repeats. */
export const COMPOSER_PILL_RADIUS = "rounded-[28px]";

export const COMPOSER_TOOLBAR_BUTTON = "rounded-md text-muted-foreground";

export const COMPOSER_TOOLBAR_BUTTON_LABEL = "px-2 text-sm";

export const COMPOSER_SEND_BUTTON =
  "size-8 data-disabled:not-aria-busy:opacity-100";

/** Dense send for single-line inline composers like comment replies. */
export const COMPOSER_SEND_BUTTON_SM =
  "size-7 data-disabled:not-aria-busy:opacity-100 [&_svg:not([class*='size-'])]:size-3.5";

export const COMPOSER_SEND_ACTIVE = "";

export const COMPOSER_SEND_INERT =
  "text-muted-foreground/70 hover:brightness-100 data-disabled:not-aria-busy:cursor-default";

export const COMPOSER_CHIP_ACTION =
  "size-4 rounded text-muted-foreground hover:bg-accent";

/** Lifts a composer that floats over content; dark mode relies on its border. */
export const COMPOSER_ELEVATED_SHADOW =
  "shadow-[0_1px_2px_hsl(0_0%_0%/0.04),0_8px_24px_-6px_hsl(0_0%_0%/0.14)] dark:shadow-none";

/**
 * A soft inner light, even all the way around: a light only along the top
 * edge doubles the border there and thins out where the pill curves. White on
 * the light theme's white card wouldn't show, so it's dark mode only.
 */
export const COMPOSER_INNER_HIGHLIGHT =
  "dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_10px_rgba(255,255,255,0.04)]";

/** The inner light and the floating shadow together, since one box-shadow holds both. */
export const COMPOSER_ELEVATED_HIGHLIGHT =
  "shadow-[0_1px_2px_hsl(0_0%_0%/0.04),0_8px_24px_-6px_hsl(0_0%_0%/0.14)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_10px_rgba(255,255,255,0.04)]";

/** A round, filled toolbar button, like the attach button on the pill. */
export const COMPOSER_TOOLBAR_BUTTON_FILLED =
  "size-8 rounded-full bg-muted text-foreground hover:bg-accent dark:bg-accent/60 dark:hover:bg-accent";
