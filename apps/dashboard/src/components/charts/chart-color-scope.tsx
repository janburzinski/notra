"use client";

import { buildChartCss } from "@notra/ui/components/evilcharts/ui/echarts-chart";
import { useId, useMemo } from "react";

import type { ChartColorScopeProps } from "@/types/charts";

export function ChartColorScope({
  config,
  className,
  children,
}: ChartColorScopeProps) {
  const rawId = useId();
  const scopeId = `scope-${rawId.replace(/:/g, "")}`;
  const css = useMemo(() => buildChartCss(scopeId, config), [scopeId, config]);

  return (
    <div className={className} data-chart={scopeId}>
      <style>{css}</style>
      {children}
    </div>
  );
}
