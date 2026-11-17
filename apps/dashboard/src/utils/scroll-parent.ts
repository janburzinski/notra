const SCROLLING_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

/** The nearest ancestor that scrolls vertically, if any. */
export function findVerticalScrollParent(node: HTMLElement | null) {
  for (let el = node?.parentElement; el; el = el.parentElement) {
    if (SCROLLING_OVERFLOW.has(getComputedStyle(el).overflowY)) {
      return el;
    }
  }
  return null;
}
