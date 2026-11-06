"use client";

import { useChartEnvironment } from "@notra/ui/components/evilcharts/ui/chart-environment";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { tween } from "@notra/ui/lib/motion";
import type { EChartsPlotFrameProps } from "@notra/ui/types/charts";
import { cn } from "@notra/ui/lib/utils";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";

export function EChartsPlotFrame({
  chartId,
  className,
  containerRef,
  css,
  isLoading,
  mountRef,
  plotBefore,
  children,
}: EChartsPlotFrameProps) {
  const { loadingLabel, PlotChrome } = useChartEnvironment();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn("group/chart relative flex flex-col text-xs", className)}
      data-chart={chartId}
      ref={containerRef}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="@container relative min-h-0 w-full flex-1">
        {plotBefore}
        <div className="relative h-full min-h-0 w-full" ref={mountRef} />
        {isLoading || !PlotChrome ? null : <PlotChrome />}
      </div>
      {children}
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <LazyMotion features={domAnimation} strict>
            <m.div
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background text-primary flex items-center justify-center gap-2 rounded-md border px-2 py-0.5 text-sm"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
              transition={tween("slow")}
            >
              <Spinner className="size-3" />
              <span>{loadingLabel}</span>
            </m.div>
          </LazyMotion>
        </div>
      ) : null}
    </div>
  );
}
