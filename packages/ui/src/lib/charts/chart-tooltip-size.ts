import {
  TOOLTIP_MOVE_DURATION_S,
  TOOLTIP_MOVE_EASING,
} from "@notra/ui/constants/chart-tooltip";
import {
  fadeInNewRows,
  resetTooltipSide,
  snapshotTooltipRows,
} from "@notra/ui/lib/charts/chart-tooltip-motion";

type TooltipContent = {
  el?: HTMLElement;
  setContent: (content: unknown, ...rest: unknown[]) => void;
  hide?: () => void;
};

type ChartWithTooltipView = {
  _componentsViews?: { type?: string; _tooltipContent?: TooltipContent }[];
};

const patchedTooltipContents = new WeakSet<object>();

// `hideTip` waits for the tooltip's hideDelay. When the pointer really left a
// scrub chart, hide it in this frame so it goes together with the hover dot.
export function hideTooltipNow(chart: unknown) {
  for (const view of (chart as ChartWithTooltipView)._componentsViews ?? []) {
    view?._tooltipContent?.hide?.();
  }
}

// Any childList mutation in the document costs a full style recalc on the
// dashboard (its :has() rules make every insertion invalidate the whole tree,
// ~15 ms). ECharts' HTML tooltip empties and re-appends the element returned
// by the formatter on every data-index change, so scrubbing a dense series
// paid that recalc each frame. Skip the re-append when the formatter handed
// back the element that is already mounted; its content is morphed in place.
export function keepTooltipContentMounted(chart: unknown) {
  const views = (chart as ChartWithTooltipView)._componentsViews ?? [];
  for (const view of views) {
    const content = view?._tooltipContent;
    if (!content) {
      continue;
    }
    const proto = Object.getPrototypeOf(content) as TooltipContent | null;
    if (!proto || patchedTooltipContents.has(proto)) {
      continue;
    }
    patchedTooltipContents.add(proto);
    const setContent = proto.setContent;
    proto.setContent = function (
      this: TooltipContent,
      next: unknown,
      ...rest: unknown[]
    ) {
      const el = this.el;
      if (
        el &&
        next instanceof HTMLElement &&
        el.childNodes.length === 1 &&
        el.firstChild === next
      ) {
        return;
      }
      setContent.call(this, next, ...rest);
    };
  }
}

function morphAttributes(target: Element, source: Element) {
  for (const attr of Array.from(target.attributes)) {
    if (!source.hasAttribute(attr.name)) {
      target.removeAttribute(attr.name);
    }
  }
  for (const attr of Array.from(source.attributes)) {
    if (target.getAttribute(attr.name) !== attr.value) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

// Updates text and attributes in place and only touches the tree where the
// structure actually differs (rows added or removed), so a scrub across
// same-shaped tooltips never inserts nodes.
function morphChildren(target: Node, source: Node) {
  const next = Array.from(source.childNodes);
  for (const [index, sourceChild] of next.entries()) {
    const targetChild = target.childNodes[index];
    if (!targetChild) {
      target.appendChild(sourceChild);
      continue;
    }
    if (
      targetChild.nodeType !== sourceChild.nodeType ||
      targetChild.nodeName !== sourceChild.nodeName
    ) {
      targetChild.replaceWith(sourceChild);
      continue;
    }
    if (targetChild instanceof Element && sourceChild instanceof Element) {
      morphAttributes(targetChild, sourceChild);
      morphChildren(targetChild, sourceChild);
    } else if (targetChild.nodeValue !== sourceChild.nodeValue) {
      targetChild.nodeValue = sourceChild.nodeValue;
    }
  }
  while (target.childNodes.length > next.length) {
    target.lastChild?.remove();
  }
}

export function withTooltipSizeMotion(formatter: (params: unknown) => string) {
  let container: HTMLDivElement | undefined;
  let template: HTMLTemplateElement | undefined;
  let animation: Animation | undefined;
  let lastHtml = "";
  // Widest the tooltip has been during this hover. Days with shorter labels
  // or fewer rows would otherwise narrow it, and a tooltip left of the
  // pointer would shift all its text sideways with every such day.
  let stickyWidth = 0;

  return (params: unknown): string | HTMLElement => {
    const html = formatter(params);
    if (!html || typeof document === "undefined") {
      animation?.cancel();
      lastHtml = "";
      return html;
    }
    container ??= document.createElement("div");
    if (html === lastHtml && container.firstElementChild) {
      return container;
    }
    const rowsBefore = lastHtml === "" ? null : snapshotTooltipRows(container);
    lastHtml = html;
    const previous = container.firstElementChild?.getBoundingClientRect();
    animation?.cancel();
    container.style.width = "";
    container.style.height = "";
    template ??= document.createElement("template");
    template.innerHTML = html;
    morphChildren(container, template.content);
    const surface = container.firstElementChild;
    const wasShown = previous !== undefined && previous.width > 0;
    if (surface instanceof HTMLElement) {
      if (!wasShown) {
        stickyWidth = 0;
        resetTooltipSide(surface);
      }
      // Detached on the very first hover, so nothing can be measured yet;
      // keep the shell's own min-width class until something can.
      const width = surface.getBoundingClientRect().width;
      if (width > 0) {
        stickyWidth = Math.max(stickyWidth, width);
        surface.style.minWidth = `${stickyWidth}px`;
      }
    }
    if (
      surface instanceof HTMLElement &&
      previous &&
      wasShown &&
      previous.height > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const next = surface.getBoundingClientRect();
      container.style.width = `${next.width}px`;
      container.style.height = `${next.height}px`;
      // Only the height morphs; the width snaps. Scaling the width from the
      // top-left corner clips the right-aligned numbers while it grows, and
      // when the tooltip sits left of the pointer the old, wider box covers
      // the hover line while it shrinks.
      if (previous.height !== next.height) {
        queueMicrotask(() => {
          if (
            container?.firstElementChild !== surface ||
            !container.isConnected
          ) {
            return;
          }
          animation = surface.animate(
            [
              { "--ec-tooltip-scale-y": previous.height / next.height },
              { "--ec-tooltip-scale-y": 1 },
            ],
            {
              duration: TOOLTIP_MOVE_DURATION_S * 1000,
              easing: TOOLTIP_MOVE_EASING,
            }
          );
        });
      }
    }
    if (rowsBefore) {
      fadeInNewRows(container, rowsBefore);
    }
    return container;
  };
}
