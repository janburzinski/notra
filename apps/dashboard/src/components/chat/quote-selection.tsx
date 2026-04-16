"use client";

import { QuoteUpIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";

export const QUOTABLE_DATA_ATTR = "data-ai-quotable";
export const QUOTABLE_SELECTOR = '[data-ai-quotable="true"]';
const ASSISTANT_SELECTOR = ".is-assistant";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

interface QuoteSelectionTooltipProps {
  onQuote: (text: string) => void;
}

function resolveElement(node: Node | null): Element | null {
  if (!node) {
    return null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }
  return node.parentElement;
}

function getQuotableSelection(): { text: string; rect: DOMRect } | null {
  if (typeof window === "undefined") {
    return null;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    return null;
  }
  const text = sel.toString().trim();
  if (!text) {
    return null;
  }

  const range = sel.getRangeAt(0);
  const startEl = resolveElement(range.startContainer);
  const endEl = resolveElement(range.endContainer);
  if (!(startEl && endEl)) {
    return null;
  }

  const startQuotable = startEl.closest(QUOTABLE_SELECTOR);
  const endQuotable = endEl.closest(QUOTABLE_SELECTOR);
  if (!(startQuotable && endQuotable)) {
    return null;
  }

  const startAssistant = startEl.closest(ASSISTANT_SELECTOR);
  const endAssistant = endEl.closest(ASSISTANT_SELECTOR);
  if (!startAssistant || startAssistant !== endAssistant) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  return { text, rect };
}

export function QuoteSelectionTooltip({ onQuote }: QuoteSelectionTooltipProps) {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const match = getQuotableSelection();
      if (!match) {
        setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      setState({
        visible: true,
        x: match.rect.left + match.rect.width / 2,
        y: match.rect.top,
        text: match.text,
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (tooltipRef.current?.contains(event.target as Node)) {
        return;
      }
      window.setTimeout(update, 0);
    };

    const handleKeyUp = () => {
      window.setTimeout(update, 0);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (tooltipRef.current?.contains(event.target as Node)) {
        return;
      }
      setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!state.visible) {
    return null;
  }

  return (
    <div
      className="-translate-x-1/2 -translate-y-[calc(100%+6px)] pointer-events-auto fixed z-50"
      ref={tooltipRef}
      style={{ top: state.y, left: state.x }}
    >
      <button
        className="flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1 font-medium text-popover-foreground text-xs shadow-md transition-colors hover:bg-accent"
        onClick={() => {
          const quoted = state.text;
          setState((prev) => ({ ...prev, visible: false }));
          onQuote(quoted);
        }}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        <HugeiconsIcon className="size-3.5" icon={QuoteUpIcon} />
        Quote
      </button>
    </div>
  );
}
