import type { TooltipValueFormatter } from "@notra/ui/types/charts";

export function withLocaleTooltip<
  T extends { tooltip: { valueFormatter?: TooltipValueFormatter } },
>(collected: T, locale: string): T {
  return {
    ...collected,
    tooltip: {
      ...collected.tooltip,
      valueFormatter:
        collected.tooltip.valueFormatter ??
        ((value: number) => value.toLocaleString(locale)),
    },
  };
}

export function withLocaleValueAxis<
  T extends {
    yAxis: { tickFormatter?: (value: number, index: number) => string };
  },
>(collected: T, locale: string): T {
  return {
    ...collected,
    yAxis: {
      ...collected.yAxis,
      tickFormatter:
        collected.yAxis.tickFormatter ??
        ((value: number) => value.toLocaleString(locale)),
    },
  };
}
