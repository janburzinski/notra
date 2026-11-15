/** How long the indicator takes to land on a newly active tab, in ms. */
export const ICON_TABS_INDICATOR_MS = 200;

/** Points in the `linear()` curve that approximates `easeOutQuint`. */
export const ICON_TABS_EASING_STEPS = 20;

/** `--ease-out`, for browsers without CSS `linear()` easing. */
export const ICON_TABS_EASING_FALLBACK = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Eased share of the slide over which an outgoing icon fades out. Icons move
 * with their labels, which can head past the list's edge, so it goes early.
 */
export const ICON_TABS_ICON_FADE_OUT = 0.4;

/**
 * Eased point from which an incoming icon that has to travel fades in. It
 * starts a slot's width left of where it lands, which can be outside the
 * list, so it only shows once nearly there.
 */
export const ICON_TABS_ICON_FADE_IN = 0.5;
