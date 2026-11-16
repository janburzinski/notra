/** How long a swapped word takes to settle, in ms. */
export const CYCLE_WORD_DURATION_MS = 550;

/** Share of the duration spread across the characters as stagger. */
export const CYCLE_WORD_STAGGER = 0.3;

/** Leaving glyphs run for this share of the duration. */
export const CYCLE_WORD_EXIT = 0.6;

/** Slightly springy settle; needs CSS `linear()` easing support. */
export const CYCLE_WORD_SPRING_EASING =
  "linear(0,.1052,.3155,.532,.7112,.8414,.9265,.9765,1.0023,1.013,1.0151,1.0133,1.01,1.0068,1.0041,1.0022,1.001,1)";

export const CYCLE_WORD_FALLBACK_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Easing for the words around the swap sliding to their new place. */
export const CYCLE_LINE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export const CYCLE_CHAR_HIDDEN_ENTER = {
  opacity: 0,
  transform: "translateY(0.35em) scale(0.6) rotate(2deg)",
  filter: "blur(0.1em)",
} as const;

export const CYCLE_CHAR_HIDDEN_EXIT = {
  opacity: 0,
  transform: "translateY(-0.35em) scale(0.6) rotate(2deg)",
  filter: "blur(0.1em)",
} as const;

export const CYCLE_CHAR_SHOWN = {
  opacity: 1,
  transform: "none",
  filter: "blur(0)",
} as const;
