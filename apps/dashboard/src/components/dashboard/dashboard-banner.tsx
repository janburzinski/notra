"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dithering } from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import {
  DASHBOARD_BANNER_COLORS_DARK,
  DASHBOARD_BANNER_COLORS_LIGHT,
  DASHBOARD_BANNER_DITHER_SCALE,
  DASHBOARD_BANNER_DITHER_SHAPE,
  DASHBOARD_BANNER_DITHER_SIZE,
  DASHBOARD_BANNER_DITHER_SPEED,
  DASHBOARD_BANNER_DITHER_TYPE,
} from "@/constants/dashboard-banner";
import type { DashboardBannerProps } from "@/types/components/dashboard-banner";

export function DashboardBanner({
  action,
  dismissLabel,
  message,
  onDismiss,
}: DashboardBannerProps) {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const colors =
    resolvedTheme === "dark"
      ? DASHBOARD_BANNER_COLORS_DARK
      : DASHBOARD_BANNER_COLORS_LIGHT;

  return (
    <div className="relative isolate flex h-full w-full items-center justify-center overflow-hidden bg-white pr-11 pl-3 dark:bg-[#131316]">
      <Dithering
        className="absolute -inset-px -z-10 size-[calc(100%+2px)] min-h-full min-w-full"
        colorBack={colors.colorBack}
        colorFront={colors.colorFront}
        scale={DASHBOARD_BANNER_DITHER_SCALE}
        shape={DASHBOARD_BANNER_DITHER_SHAPE}
        size={DASHBOARD_BANNER_DITHER_SIZE}
        speed={shouldReduceMotion ? 0 : DASHBOARD_BANNER_DITHER_SPEED}
        type={DASHBOARD_BANNER_DITHER_TYPE}
      />
      <div className="text-foreground flex min-w-0 items-center gap-3">
        <span className="min-w-0 text-sm leading-tight font-medium text-pretty max-sm:line-clamp-2 max-sm:text-xs">
          {message}
        </span>
        {action ? (
          <Button
            className="shrink-0"
            render={<Link href={action.href} />}
            size="sm"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          aria-label={dismissLabel}
          className="absolute top-1/2 right-3 -translate-y-1/2"
          onClick={onDismiss}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
        </Button>
      ) : null}
    </div>
  );
}
