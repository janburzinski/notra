"use client";

import { AnimatedNumber } from "@notra/ui/components/animated-number";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

import { ChartSparkline } from "@/components/charts/chart-sparkline";
import { CHART_PRIMARY_COLOR, CHART_REFERRAL_COLOR } from "@/constants/charts";
import { CONTENT_AGENT_REACH_TREND_BUCKET_DAYS } from "@/constants/content-overview";
import { cn } from "@/lib/utils";
import type { AgentReachStatsProps } from "@/types/content/agent-reach";
import { bucketAgentReachTrend } from "@/utils/content-agent-reach";

export function AgentReachStats({ totals, trends }: AgentReachStatsProps) {
  const tShared = useTranslations("geo.shared");
  const stats = [
    { key: "crawled", label: tShared("crawlers"), color: CHART_PRIMARY_COLOR },
    { key: "cited", label: tShared("cited"), color: CHART_PRIMARY_COLOR },
    {
      key: "referred",
      label: tShared("referrals"),
      color: CHART_REFERRAL_COLOR,
    },
  ] as const;

  return (
    <div className={TABLE_FRAME_CLASS}>
      <dl className={cn(TABLE_BODY_CLASS, "grid grid-cols-3 overflow-hidden")}>
        {stats.map((stat) => (
          <div
            className="border-border/60 relative isolate flex min-w-0 flex-col gap-1 overflow-hidden border-r px-3 py-2.5 last:border-r-0"
            key={stat.key}
          >
            {trends[stat.key].some((value) => value > 0) ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 bottom-0 -z-10 h-3/4 w-2/3 opacity-60"
              >
                <ChartSparkline
                  className="h-full w-full"
                  color={stat.color}
                  data={bucketAgentReachTrend(
                    trends[stat.key],
                    CONTENT_AGENT_REACH_TREND_BUCKET_DAYS
                  )}
                />
              </div>
            ) : null}
            <dt className="text-muted-foreground truncate text-xs">
              {stat.label}
            </dt>
            <dd>
              <AnimatedNumber
                className="text-lg font-semibold tabular-nums"
                value={totals[stat.key]}
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
