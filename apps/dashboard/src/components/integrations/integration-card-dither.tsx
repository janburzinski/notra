"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const FADE_OUT_DURATION = 300;

const Dithering = dynamic(
  () =>
    import("@paper-design/shaders-react").then((module_) => module_.Dithering),
  { ssr: false }
);

export function IntegrationCardDither({ color }: { color: string }) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointerActiveRef = useRef(false);
  const focusActiveRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);
  const colorFront = HEX_COLOR_PATTERN.test(color) ? `${color}26` : color;

  useEffect(() => {
    const card = containerRef.current?.closest<HTMLElement>(
      '[data-slot="title-card"]'
    );
    if (!card) {
      return;
    }

    const show = () => {
      clearTimeout(hideTimeoutRef.current);
      setShouldRender(true);
    };
    const hide = () => {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(
        () => setShouldRender(false),
        FADE_OUT_DURATION
      );
    };
    const hideIfInactive = () => {
      if (!(pointerActiveRef.current || focusActiveRef.current)) {
        hide();
      }
    };
    const handlePointerEnter = () => {
      pointerActiveRef.current = true;
      show();
    };
    const handlePointerLeave = () => {
      pointerActiveRef.current = false;
      hideIfInactive();
    };
    const handleFocusIn = () => {
      focusActiveRef.current = true;
      show();
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (!card.contains(event.relatedTarget as Node | null)) {
        focusActiveRef.current = false;
        hideIfInactive();
      }
    };

    card.addEventListener("pointerenter", handlePointerEnter);
    card.addEventListener("pointerleave", handlePointerLeave);
    card.addEventListener("focusin", handleFocusIn);
    card.addEventListener("focusout", handleFocusOut);

    return () => {
      clearTimeout(hideTimeoutRef.current);
      card.removeEventListener("pointerenter", handlePointerEnter);
      card.removeEventListener("pointerleave", handlePointerLeave);
      card.removeEventListener("focusin", handleFocusIn);
      card.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <div className="h-full w-full" ref={containerRef}>
      {shouldRender ? (
        <Dithering
          className="-translate-x-1/2 -translate-y-1/2 absolute top-0 left-0 h-[200%] w-[200%]"
          colorBack="#00000000"
          colorFront={colorFront}
          scale={0.74}
          shape="wave"
          size={4}
          speed={shouldReduceMotion ? 0 : 0.5}
          type="4x4"
        />
      ) : null}
    </div>
  );
}
