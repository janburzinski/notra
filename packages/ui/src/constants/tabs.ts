import { tween } from "@notra/ui/lib/motion";

/** Line-variant underline: slides to the new tab without a bounce. */
export const LINE_INDICATOR_TRANSITION = tween("normal");

/** Used instead when the user prefers reduced motion. */
export const INSTANT_TRANSITION = { duration: 0 } as const;
