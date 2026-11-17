"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@notra/ui/components/ui/chart";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- this whole component is loaded with next/dynamic by autopilot-health-client
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AUTOPILOT_HEALTH_RUNS_CONFIG } from "@/constants/autopilot";
import type { AutopilotHealthChartProps } from "@/types/autopilot";

const HOUR_FORMAT = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  timeZone: "UTC",
});
const DAY_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Runs per hour or UTC day, by how they ended. */
export function AutopilotHealthChart({
  buckets,
  hourly,
}: AutopilotHealthChartProps) {
  const format = (value: string) =>
    (hourly ? HOUR_FORMAT : DAY_FORMAT).format(new Date(value));

  return (
    <ChartContainer
      className="aspect-auto h-48 w-full"
      config={AUTOPILOT_HEALTH_RUNS_CONFIG}
    >
      <BarChart accessibilityLayer data={buckets}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="at"
          minTickGap={24}
          tickFormatter={format}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                hourly
                  ? `${DAY_FORMAT.format(new Date(String(value)))}, ${format(String(value))} UTC`
                  : format(String(value))
              }
            />
          }
          cursor={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {/* Ranges have different bucket counts; morphing between them means nothing. */}
        <Bar
          dataKey="completed"
          fill="var(--color-completed)"
          isAnimationActive={false}
          stackId="runs"
        />
        <Bar
          dataKey="failed"
          fill="var(--color-failed)"
          isAnimationActive={false}
          stackId="runs"
        />
        <Bar
          dataKey="stopped"
          fill="var(--color-stopped)"
          isAnimationActive={false}
          stackId="runs"
        />
      </BarChart>
    </ChartContainer>
  );
}
