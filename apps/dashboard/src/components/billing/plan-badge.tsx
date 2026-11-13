"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { startPlanBadgeRenderer } from "@/lib/billing/plan-badge-renderer";
import { cn } from "@/lib/utils";
import type { PlanBadgeTier } from "@/types/billing/plan-badge";

/**
 * Smoked-glass plan badge with a chrome edge, rendered with a WebGPU shader.
 * Browsers without WebGPU keep the plain CSS badge.
 */
export function PlanBadge({
  children,
  className,
  tier,
}: {
  children: ReactNode;
  className?: string;
  tier: PlanBadgeTier;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isShaderReady, setIsShaderReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && "gpu" in navigator)) {
      return;
    }

    const controller = new AbortController();
    const cleanups: (() => void)[] = [];
    const release = () => {
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup();
      }
    };

    startPlanBadgeRenderer(canvas, tier, cleanups, controller.signal)
      .then((isStarted) => {
        if (isStarted) {
          setIsShaderReady(true);
        }
      })
      .catch(() => {
        // No usable adapter: release what started; the CSS badge stays.
        release();
      });

    return () => {
      controller.abort();
      release();
    };
  }, [tier]);

  return (
    <span
      className={cn(
        "text-2xs relative inline-flex h-5 w-fit shrink-0 items-center rounded-md px-1.75 font-semibold whitespace-nowrap text-white/90",
        // The CSS badge stays under the canvas until the glass has faded in
        // over it, so the white label never sits on the bare popover.
        isShaderReady
          ? "duration-fast transition-[background-color,box-shadow] delay-200 ease-out"
          : "bg-black/90 ring-1 ring-white/20 ring-inset",
        className
      )}
      data-slot="plan-badge"
    >
      <canvas
        aria-hidden
        className={cn(
          "duration-normal pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity ease-out",
          isShaderReady && "opacity-100"
        )}
        ref={canvasRef}
      />
      <span className="relative">{children}</span>
    </span>
  );
}
