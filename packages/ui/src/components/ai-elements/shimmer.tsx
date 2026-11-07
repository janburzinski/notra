"use client";

import {
  type CSSProperties,
  type ElementType,
  memo,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { cn } from "@notra/ui/lib/utils";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 1.7,
  spread = 4,
}: TextShimmerProps) => {
  const textId = `text-shimmer-${useId().replaceAll(":", "")}`;
  const ref = useRef<HTMLElement>(null);

  // Every shimmer runs on one clock, so one that replaces another, or gets a
  // new label, carries on mid-sweep instead of flashing back to the start.
  useLayoutEffect(() => {
    const now = document.timeline.currentTime;
    const elapsed = typeof now === "number" ? now : performance.now();
    ref.current?.style.setProperty(
      "--text-shimmer-phase",
      `${String(-(elapsed % (duration * 1000)))}ms`
    );
  }, [children, duration]);

  return (
    <Component
      className={cn("text-shimmer", className)}
      ref={ref}
      style={
        {
          "--text-shimmer-duration": `${duration}s`,
          "--text-shimmer-firefox-mask": `-moz-element(#${textId})`,
          "--text-shimmer-spread": `${spread}ch`,
        } as CSSProperties
      }
    >
      <span className="text-shimmer__text" id={textId}>
        {children}
      </span>
      <span
        aria-hidden="true"
        className="text-shimmer__mask"
        inert
        key={children}
      >
        {children}
      </span>
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
