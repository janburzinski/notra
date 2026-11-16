import type { ChartArtifact } from "@notra/ai/types/chart-artifact";

export interface ToolOutputChartProps {
  chart: ChartArtifact;
  className?: string;
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
