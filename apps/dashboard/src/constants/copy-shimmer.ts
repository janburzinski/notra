/** How long the light band takes to cross the copied text. */
export const COPY_SHIMMER_DURATION_MS = 700;

/** Even speed with soft ends, so the streak is readable the whole way. */
export const COPY_SHIMMER_EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

/**
 * The band: a soft diagonal streak of light, brightest in the middle. Light
 * mode needs a stronger streak to show on its pale selection color.
 */
export const COPY_SHIMMER_GRADIENT = {
  light:
    "linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.9) 50%, transparent 70%)",
  dark: "linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.55) 50%, transparent 70%)",
} as const;

/** Lines closer than this belong to the same row of selected text. */
export const COPY_SHIMMER_ROW_TOLERANCE_PX = 2;
