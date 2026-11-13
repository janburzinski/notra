"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@notra/ui/components/ui/chart";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- this whole component is loaded with next/dynamic by overview-client
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { SiteChartTooltip } from "@/components/sites/site-chart-tooltip";
import {
  OVERVIEW_GROWTH_CONFIG,
  OVERVIEW_USAGE_CONFIG,
} from "@/constants/overview";
import { SITE_CHART_HEIGHT_CLASS } from "@/constants/site-charts";
import type { OverviewSectionProps } from "@/types/overview";
import type { SiteChartCardProps } from "@/types/sites";
import { formatChartDay } from "@/utils/site-charts";

function ChartCard({ title, description, children }: SiteChartCardProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {children}
    </div>
  );
}

const xAxis = (
  <XAxis
    axisLine={false}
    dataKey="day"
    minTickGap={24}
    tickFormatter={formatChartDay}
    tickLine={false}
    tickMargin={8}
  />
);

const yAxis = (
  <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
);

export function OverviewCharts({ insights }: OverviewSectionProps) {
  const activity = insights?.activity;
  const description = insights
    ? `Last ${insights.days} days, by UTC day`
    : "Loading";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartCard description={description} title="Signups and new workspaces">
        {activity ? (
          <ChartContainer
            className={SITE_CHART_HEIGHT_CLASS}
            config={OVERVIEW_GROWTH_CONFIG}
          >
            <BarChart accessibilityLayer data={activity}>
              <CartesianGrid vertical={false} />
              {xAxis}
              {yAxis}
              <ChartTooltip
                content={<SiteChartTooltip config={OVERVIEW_GROWTH_CONFIG} />}
                cursor={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="signups"
                fill="var(--color-signups)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="workspaces"
                fill="var(--color-workspaces)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </ChartCard>
      <ChartCard description={description} title="Product usage">
        {activity ? (
          <ChartContainer
            className={SITE_CHART_HEIGHT_CLASS}
            config={OVERVIEW_USAGE_CONFIG}
          >
            <LineChart accessibilityLayer data={activity}>
              <CartesianGrid vertical={false} />
              {xAxis}
              {yAxis}
              <ChartTooltip
                content={<SiteChartTooltip config={OVERVIEW_USAGE_CONFIG} />}
                cursor={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {(["content", "scans", "chats"] as const).map((key) => (
                <Line
                  dataKey={key}
                  dot={false}
                  key={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </ChartCard>
    </div>
  );
}
