import {
  ICON_TABS_EASING_FALLBACK,
  ICON_TABS_EASING_STEPS,
  ICON_TABS_ICON_FADE_IN,
  ICON_TABS_ICON_FADE_OUT,
} from "@notra/ui/constants/icon-tabs";
import type {
  IconTabsContentPosition,
  IconTabsFrame,
  IconTabsIndicatorBox,
} from "@notra/ui/types/icon-tabs";

/** Strong deceleration, close to the `ease-out` CSS curve. */
export function easeOutQuint(progress: number): number {
  return 1 - (1 - progress) ** 5;
}

let easing: string | null = null;

/**
 * `easeOutQuint` as a CSS `linear()` curve, so the compositor plays the same
 * curve the hand-off maths in `shownFrame` assumes.
 */
export function iconTabsEasing(): string {
  if (easing === null) {
    const points = Array.from({ length: ICON_TABS_EASING_STEPS + 1 }, (_, i) =>
      easeOutQuint(i / ICON_TABS_EASING_STEPS).toFixed(4)
    );
    const curve = `linear(${points.join(", ")})`;
    easing = CSS.supports("transition-timing-function", curve)
      ? curve
      : ICON_TABS_EASING_FALLBACK;
  }
  return easing;
}

export function measureActiveTab(
  list: HTMLElement
): IconTabsIndicatorBox | null {
  const tab = list.querySelector<HTMLElement>('[role="tab"][data-active]');
  if (!tab) {
    return null;
  }
  return {
    left: tab.offsetLeft,
    top: tab.offsetTop,
    width: tab.offsetWidth,
    height: tab.offsetHeight,
  };
}

export function indicatorTransform(
  box: IconTabsIndicatorBox,
  scaleX = 1
): string {
  return `translate(${box.left}px, ${box.top}px) scaleX(${scaleX})`;
}

export function applyIndicatorBox(
  element: HTMLElement,
  box: IconTabsIndicatorBox
) {
  element.style.transform = indicatorTransform(box);
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
}

/** Every tab's label and icon, in tab order. */
export function tabContentElements(list: HTMLElement) {
  return [...list.querySelectorAll<HTMLElement>('[role="tab"]')].map(
    (tab) => ({
      label: tab.querySelector<HTMLElement>('[data-slot="icon-tab-label"]'),
      glyph: tab.querySelector<HTMLElement>('[data-slot="icon-tab-glyph"]'),
      tab,
    })
  );
}

/**
 * Where each tab's label sits at rest relative to the list (layout offsets
 * ignore transforms, so this is the target even mid-slide), and where its
 * icon shows when visible: always the open slot's width left of the label,
 * so an icon fading in or out travels with its label instead of sliding
 * under the text, where a closed slot leaves it.
 */
export function measureTabContent(
  list: HTMLElement
): IconTabsContentPosition[] {
  const elements = tabContentElements(list);
  const open = elements.find(
    ({ tab, glyph }) =>
      tab.hasAttribute("data-active") || glyph?.dataset.pinned !== undefined
  );
  const iconOffset =
    open?.label && open.glyph
      ? open.label.offsetLeft - open.glyph.offsetLeft
      : 0;
  return elements.map(({ tab, label, glyph }) => {
    const labelLeft = tab.offsetLeft + (label?.offsetLeft ?? 0);
    return {
      label: labelLeft,
      glyph: labelLeft - iconOffset,
      opacity:
        tab.hasAttribute("data-active") || glyph?.dataset.pinned !== undefined
          ? 1
          : 0,
    };
  });
}

/** Where a tab's icon sits at rest, open slot or not. */
export function glyphRestLeft(tab: HTMLElement, glyph: HTMLElement): number {
  return tab.offsetLeft + glyph.offsetLeft;
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

/**
 * A tab icon's opacity `amount` (eased, 0–1) into a slide. Fading out ends
 * early; fading in while travelling starts late (see the constants).
 */
export function iconOpacity(
  from: IconTabsContentPosition,
  to: IconTabsContentPosition,
  amount: number
): number {
  if (to.opacity < from.opacity) {
    return mix(
      from.opacity,
      to.opacity,
      Math.min(1, amount / ICON_TABS_ICON_FADE_OUT)
    );
  }
  const travels = Math.abs(to.glyph - from.glyph) > 0.5;
  const start = travels ? ICON_TABS_ICON_FADE_IN : 0;
  return mix(
    from.opacity,
    to.opacity,
    Math.max(0, (amount - start) / (1 - start))
  );
}

/** The frame `amount` (eased, 0–1) of the way from `from` to `to`. */
export function mixFrames(
  from: IconTabsFrame,
  to: IconTabsFrame,
  amount: number
): IconTabsFrame {
  const sameTabs = from.content.length === to.content.length;
  return {
    box: {
      left: mix(from.box.left, to.box.left, amount),
      top: to.box.top,
      width: mix(from.box.width, to.box.width, amount),
      height: to.box.height,
    },
    content: to.content.map((target, index) => {
      const start = sameTabs ? from.content[index] : undefined;
      return start
        ? {
            label: mix(start.label, target.label, amount),
            glyph: mix(start.glyph, target.glyph, amount),
            opacity: iconOpacity(start, target, amount),
          }
        : target;
    }),
  };
}
