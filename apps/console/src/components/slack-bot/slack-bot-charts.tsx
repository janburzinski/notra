"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@notra/ui/components/ui/chart";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- this whole component is loaded with next/dynamic by slack-bot-client
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { SiteChartTooltip } from "@/components/sites/site-chart-tooltip";
import { SITE_CHART_HEIGHT_CLASS } from "@/constants/site-charts";
import {
  SLACK_BOT_ACTIVITY_CONFIG,
  SLACK_BOT_RESPONSE_CONFIG,
} from "@/constants/slack-bot";
import type { SiteChartCardProps } from "@/types/sites";
import type { SlackBotChartsProps } from "@/types/slack-bot";
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

export function SlackBotCharts({ insights }: SlackBotChartsProps) {
  const activity = insights?.activity;
  const description = insights
    ? `Last ${insights.days} days, by UTC day`
    : "Loading";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartCard description={description} title="Requests per day">
        {activity ? (
          <ChartContainer
            className={SITE_CHART_HEIGHT_CLASS}
            config={SLACK_BOT_ACTIVITY_CONFIG}
          >
            <BarChart accessibilityLayer data={activity}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="day"
                minTickGap={24}
                tickFormatter={formatChartDay}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <SiteChartTooltip config={SLACK_BOT_ACTIVITY_CONFIG} />
                }
                cursor={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="completed"
                fill="var(--color-completed)"
                stackId="requests"
              />
              <Bar
                dataKey="failed"
                fill="var(--color-failed)"
                stackId="requests"
              />
              <Bar
                dataKey="other"
                fill="var(--color-other)"
                radius={[3, 3, 0, 0]}
                stackId="requests"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </ChartCard>
      <ChartCard
        description="Median time from the Slack message to Notra's first reply"
        title="Response time"
      >
        {activity ? (
          <ChartContainer
            className={SITE_CHART_HEIGHT_CLASS}
            config={SLACK_BOT_RESPONSE_CONFIG}
          >
            <BarChart accessibilityLayer data={activity}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="day"
                minTickGap={24}
                tickFormatter={formatChartDay}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickFormatter={(value: number) => `${value}s`}
                tickLine={false}
                width={36}
              />
              <ChartTooltip
                content={
                  <SiteChartTooltip config={SLACK_BOT_RESPONSE_CONFIG} />
                }
                cursor={false}
              />
              <Bar
                dataKey="medianResponseSeconds"
                fill="var(--color-medianResponseSeconds)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </ChartCard>
    </div>
  );
}
