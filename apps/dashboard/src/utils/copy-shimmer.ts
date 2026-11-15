import {
  COPY_SHIMMER_DURATION_MS,
  COPY_SHIMMER_EASING,
  COPY_SHIMMER_GRADIENT,
  COPY_SHIMMER_ROW_TOLERANCE_PX,
} from "@/constants/copy-shimmer";

/** Boxes around the selected text itself, not the elements holding it. */
function selectedTextRects(range: Range): DOMRect[] {
  const root =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
  if (!root) {
    return [];
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const rects: DOMRect[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(range.intersectsNode(node) && node.textContent?.trim())) {
      continue;
    }
    const part = document.createRange();
    part.selectNodeContents(node);
    if (node === range.startContainer) {
      part.setStart(node, range.startOffset);
    }
    if (node === range.endContainer) {
      part.setEnd(node, range.endOffset);
    }
    rects.push(...part.getClientRects());
  }
  return rects;
}

/** The selection's lines as one box per row, so a row lights up as one strip. */
function selectionRows(range: Range): DOMRect[] {
  const rows: DOMRect[] = [];
  for (const rect of selectedTextRects(range)) {
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }
    const row = rows.find(
      (candidate) =>
        Math.abs(candidate.top - rect.top) <= COPY_SHIMMER_ROW_TOLERANCE_PX &&
        Math.abs(candidate.bottom - rect.bottom) <=
          COPY_SHIMMER_ROW_TOLERANCE_PX
    );
    if (row) {
      const left = Math.min(row.left, rect.left);
      const right = Math.max(row.right, rect.right);
      rows[rows.indexOf(row)] = new DOMRect(
        left,
        row.top,
        right - left,
        row.height
      );
    } else {
      rows.push(rect);
    }
  }
  return rows;
}

/**
 * Sweeps one band of light across the copied text, like a terminal does.
 * Every line gets a window onto the same band, so it crosses the whole
 * selection as one streak instead of one per line. The light lives inside
 * `container`, so it scrolls with the text and stays under anything floating
 * over it, like the composer. Nothing runs when the system asks for less
 * motion.
 */
function playCopyShimmer(range: Range, container: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const rows = selectionRows(range);
  if (rows.length === 0) {
    return;
  }
  const origin = container.getBoundingClientRect();
  const gradient = document.documentElement.classList.contains("dark")
    ? COPY_SHIMMER_GRADIENT.dark
    : COPY_SHIMMER_GRADIENT.light;
  const left = Math.min(...rows.map((row) => row.left));
  const top = Math.min(...rows.map((row) => row.top));
  const width = Math.max(...rows.map((row) => row.right)) - left;
  const height = Math.max(...rows.map((row) => row.bottom)) - top;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
  });
  const animations: Animation[] = [];
  for (const row of rows) {
    const line = document.createElement("div");
    Object.assign(line.style, {
      position: "absolute",
      left: `${row.left - origin.left}px`,
      top: `${row.top - origin.top}px`,
      width: `${row.width}px`,
      height: `${row.height}px`,
      overflow: "hidden",
      borderRadius: "2px",
    });
    const band = document.createElement("div");
    Object.assign(band.style, {
      position: "absolute",
      left: `${left - row.left}px`,
      top: `${top - row.top}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundImage: gradient,
    });
    line.append(band);
    layer.append(line);
    animations.push(
      band.animate(
        // The streak sits in the middle of the band, so ±60% carries it from
        // just before the first letter to just past the last one.
        [{ transform: "translateX(-60%)" }, { transform: "translateX(60%)" }],
        { duration: COPY_SHIMMER_DURATION_MS, easing: COPY_SHIMMER_EASING }
      )
    );
  }
  container.append(layer);
  Promise.all(animations.map((animation) => animation.finished))
    .catch(() => undefined)
    .finally(() => layer.remove());
}

/** A copy handler: the shimmer over what is selected, if anything is. */
export function playCopyShimmerOnSelection(event: { currentTarget: Element }) {
  const selection = window.getSelection();
  if (
    !(event.currentTarget instanceof HTMLElement) ||
    !selection ||
    selection.isCollapsed ||
    selection.rangeCount === 0
  ) {
    return;
  }
  playCopyShimmer(selection.getRangeAt(0), event.currentTarget);
}
