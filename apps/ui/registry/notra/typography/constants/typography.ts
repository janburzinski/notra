/**
 * Display steps per heading size. Hero and section grow a step from `sm` up.
 * Pick a size with the `size` prop; a `text-*` size in `className` won't replace it.
 */
export const HEADING_SIZE_CLASSES = {
  hero: "text-display-lg sm:text-display-2xl",
  section: "text-display-md sm:text-display-xl",
  title: "text-display-sm",
  subhead: "text-display-xs",
} as const;

export const TEXT_SIZE_CLASSES = {
  lg: "text-lg",
  base: "text-base",
  sm: "text-sm",
  xs: "text-xs",
  "2xs": "text-2xs",
} as const;

export const TEXT_TONE_CLASSES = {
  default: "text-foreground",
  muted: "text-muted-foreground",
} as const;

export const TEXT_WEIGHT_CLASSES = {
  regular: "font-normal",
  medium: "font-medium",
} as const;
