export const COMPOSER_TRAY_TRANSITION =
  "transition-[background-color,padding] duration-slow ease-emphasized-in-out motion-reduce:transition-none";

export const COMPOSER_INPUT =
  "block max-h-50 min-h-12 min-w-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-2 text-foreground text-sm leading-6 caret-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent md:text-sm dark:bg-transparent dark:disabled:bg-transparent";

export const COMPOSER_TOOLBAR_BUTTON = "rounded-md text-muted-foreground";

export const COMPOSER_TOOLBAR_BUTTON_LABEL = "px-2 text-sm";

export const COMPOSER_SEND_BUTTON =
  "size-8 rounded-[10px] active:scale-[0.96] data-disabled:not-aria-busy:opacity-100";

export const COMPOSER_SEND_ACTIVE =
  "bg-foreground text-background hover:bg-foreground/85 hover:text-background dark:hover:bg-foreground/85";

export const COMPOSER_SEND_INERT =
  "bg-foreground/[0.08] text-muted-foreground/70 hover:bg-foreground/[0.08] hover:text-muted-foreground/70 dark:hover:bg-foreground/[0.08] data-disabled:not-aria-busy:cursor-default";

export const COMPOSER_CHIP_ACTION =
  "size-4 rounded text-muted-foreground hover:bg-accent";
