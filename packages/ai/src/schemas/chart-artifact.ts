import { CHART_UNITS } from "@notra/ai/constants/chart-artifact";
import * as z from "zod";

const chartTitleSchema = z.string().min(1);
const chartSubtitleSchema = z.string().optional();

export const chartPointSchema = z.object({
  x: z.string(),
  y: z.number(),
});

export const chartSeriesSchema = z.object({
  name: z.string().min(1),
  points: z.array(chartPointSchema),
});

export const chartSegmentSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  other: z
    .boolean()
    .optional()
    .describe(
      "true for the segment that sums every category not drawn by name"
    ),
});

const chartMetaSchema = {
  title: chartTitleSchema,
  subtitle: chartSubtitleSchema,
  unit: z
    .enum(CHART_UNITS)
    .optional()
    .describe(
      "percent when values are percentages from 0 to 100, count for plain numbers"
    ),
};

export const emptyChartArtifactSchema = z.object({
  kind: z.literal("empty"),
  ...chartMetaSchema,
  emptyMessage: z.string().min(1),
});

export const barChartArtifactSchema = z.object({
  kind: z.literal("bar"),
  ...chartMetaSchema,
  segments: z.array(chartSegmentSchema).min(1),
});

export const pieChartArtifactSchema = z.object({
  kind: z.literal("pie"),
  ...chartMetaSchema,
  segments: z.array(chartSegmentSchema).min(1),
});

export const areaChartArtifactSchema = z.object({
  kind: z.literal("area"),
  ...chartMetaSchema,
  series: z.array(chartSeriesSchema).min(1),
});

export const chartArtifactSchema = z.discriminatedUnion("kind", [
  emptyChartArtifactSchema,
  barChartArtifactSchema,
  pieChartArtifactSchema,
  areaChartArtifactSchema,
]);

export const toolOutputChartSchema = z.looseObject({
  chart: chartArtifactSchema,
});

export const showChartInputSchema = z.object({
  chart: chartArtifactSchema.describe(
    "area for trends over time (x is an ISO date like 2026-11-03 or a short label), bar for ranking categories, pie for shares of a whole. Use only numbers other tools returned."
  ),
});
