import {
  TOOLTIP_FLIP_MS,
  TOOLTIP_MOVE_EASING,
  TOOLTIP_ROW_FADE_MS,
} from "@notra/ui/constants/chart-tooltip";

// Hover tooltips are morphed in place (chart-tooltip-size). Rows that a new
// day adds fade in instead of popping. Values and the date swap instantly:
// they change many times a second while hovering, and any fade on them reads
// as flicker.

const ROW_SELECTOR = "[data-ec-row]";

// Rows are matched by their `data-ec-row` key, not by node: the morph reuses
// nodes by position, so a row added in the middle lands in an old node.
function rowKey(row: Element | null | undefined): string | null {
  return row?.getAttribute("data-ec-row") ?? null;
}

export function snapshotTooltipRows(container: Element): Set<string> {
  const keys = new Set<string>();
  for (const row of container.querySelectorAll(ROW_SELECTOR)) {
    const key = rowKey(row);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

export function fadeInNewRows(container: Element, before: Set<string>) {
  for (const row of container.querySelectorAll(ROW_SELECTOR)) {
    const key = rowKey(row);
    const parentKey = rowKey(row.parentElement?.closest(ROW_SELECTOR));
    // A row inside a group that is new itself fades with its group.
    if (!key || before.has(key) || (parentKey && !before.has(parentKey))) {
      continue;
    }
    row.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: TOOLTIP_ROW_FADE_MS,
      easing: TOOLTIP_MOVE_EASING,
    });
  }
}

const FLIP_ANIMATION_ID = "ec-tooltip-flip";

// Which side of the pointer each tooltip sat on at its last position.
const tooltipSides = new WeakMap<Element, { x: number; right: boolean }>();

/** Forget the side when a tooltip shows again, so it never glides in. */
export function resetTooltipSide(surface: Element) {
  tooltipSides.delete(surface);
}

function currentTranslateX(el: Element): number {
  const value = Number.parseFloat(getComputedStyle(el).translate);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Scrub tooltips follow the pointer without a transition. When one switches
 * to the other side of the pointer, glide the surface across instead of
 * jumping the width of the tooltip in a single frame.
 */
export function glideOnSideFlip(host: unknown, pointerX: number, x: number) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const surface = host.querySelector(".ec-tooltip-surface");
  if (!surface) {
    return;
  }
  const right = x >= pointerX;
  const last = tooltipSides.get(surface);
  tooltipSides.set(surface, { x, right });
  if (
    !last ||
    last.right === right ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  // A flip back mid-glide starts from where the surface is right now.
  const from = last.x + currentTranslateX(surface) - x;
  for (const animation of surface.getAnimations()) {
    if (animation.id === FLIP_ANIMATION_ID) {
      animation.cancel();
    }
  }
  const glide = surface.animate(
    [{ translate: `${from}px 0` }, { translate: "0 0" }],
    { duration: TOOLTIP_FLIP_MS, easing: TOOLTIP_MOVE_EASING }
  );
  glide.id = FLIP_ANIMATION_ID;
}
