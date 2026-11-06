"use client";

import {
  DEFAULT_CHART_LOADING_LABEL,
  DEFAULT_CHART_LOCALE,
} from "@notra/ui/constants/chart-tooltip";
import type { ChartEnvironment } from "@notra/ui/types/charts";
import { createContext, type ReactNode, use } from "react";

const ChartEnvironmentContext = createContext<ChartEnvironment>({
  locale: DEFAULT_CHART_LOCALE,
  loadingLabel: DEFAULT_CHART_LOADING_LABEL,
});

/** Gives every chart below it the host app's locale, loading label and plot chrome. */
export function ChartEnvironmentProvider({
  value,
  children,
}: {
  value: ChartEnvironment;
  children: ReactNode;
}) {
  return <ChartEnvironmentContext value={value}>{children}</ChartEnvironmentContext>;
}

export function useChartEnvironment(): ChartEnvironment {
  return use(ChartEnvironmentContext);
}
