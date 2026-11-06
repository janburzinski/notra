"use client";

import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useLocale, useTranslations } from "use-intl";

import { TrafficSourceGroupIcon } from "@/components/geo/traffic-source-group-icon";
import type { AgentReachEngineRowProps } from "@/types/content/agent-reach";

export function AgentReachEngineRow({ engine, max }: AgentReachEngineRowProps) {
  const t = useTranslations("content.overview.agentReach");
  const locale = useLocale();
  return (
    <li className="border-border/60 grid h-9 grid-cols-[1rem_minmax(0,1fr)_minmax(3rem,5rem)_2.5rem] items-center gap-2.5 border-b text-xs last:border-b-0">
      <TrafficSourceGroupIcon className="size-4" group={engine} />
      <span className="text-foreground truncate font-medium">
        {engine.label}
      </span>
      <GeoBar fillClassName="bg-foreground/25" max={max} value={engine.total} />
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground cursor-default text-right tabular-nums" />
          }
        >
          {engine.total.toLocaleString(locale)}
        </TooltipTrigger>
        <TooltipContent>
          {t("totals", {
            crawled: engine.crawled,
            cited: engine.cited,
            referred: engine.referred,
          })}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
