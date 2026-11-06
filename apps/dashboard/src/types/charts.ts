import type {
  ChartColorPair,
  ChartConfig,
  TooltipValueFormatter,
} from "@notra/ui/types/charts";
import type { ReactNode } from "react";

export interface ChartColorScopeProps {
  config: ChartConfig;
  className?: string;
  children: ReactNode;
}

export interface ChartSparklineProps {
  data: number[];
  labels?: string[];
  color: ChartColorPair;
  className?: string;
  markIncompleteTail?: boolean;
  tooltipValueFormatter?: TooltipValueFormatter;
}

export interface SparklinePathInput {
  values: readonly number[];
  width: number;
  height: number;
  padding?: number;
}
