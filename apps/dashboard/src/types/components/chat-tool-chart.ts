import type { ChartArtifact } from "@notra/ai/types/chart-artifact";

export interface ToolOutputChartProps {
  chart: ChartArtifact;
  className?: string;
}

export interface ToolOutputChartPlotProps extends ToolOutputChartProps {
  /** Lines run to the card's edges, for charts inside a table-style frame. */
  flush?: boolean;
}

export interface ToolOutputRankRow {
  engine: string;
  name: string;
  value: number;
  valueLabel: string;
  widthPercent: number;
}

export interface ToolOutputShareRow {
  key: string;
  label: string;
  value: number;
  /** Fraction of the whole, 0 to 1. */
  share: number;
  other: boolean;
}
