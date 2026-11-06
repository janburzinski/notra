"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AI_TRAFFIC_DEFAULT_DAYS } from "@notra/geo-core/constants/geo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { AgentReachEmpty } from "@/components/content/overview/agent-reach-empty";
import { AgentReachEngineRow } from "@/components/content/overview/agent-reach-engine-row";
import { AgentReachStats } from "@/components/content/overview/agent-reach-stats";
import { OverviewHint } from "@/components/content/overview/overview-field";
import { CONTENT_AGENT_REACH_ENGINE_LIMIT } from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentAgentReachProps } from "@/types/content/agent-reach";
import {
  agentReachDailyVisitsByKind,
  agentReachEngines,
} from "@/utils/content-agent-reach";

export function ContentAgentReach({
  organizationId,
  contentId,
}: ContentAgentReachProps) {
  const t = useTranslations("content.overview.agentReach");
  const { data } = useQuery(
    dashboardOrpc.content.agentTraffic.queryOptions({
      input: { organizationId, contentId },
    })
  );
  if (!data) {
    return null;
  }

  const { totals } = data;
  const engines = agentReachEngines(data);
  const visibleEngines = engines.slice(0, CONTENT_AGENT_REACH_ENGINE_LIMIT);
  const hiddenEngines = engines.length - visibleEngines.length;
  const label = t("label");

  return (
    <Collapsible>
      <div className="flex min-h-8 items-center gap-1.5">
        <CollapsibleTrigger
          render={
            <button
              className="text-foreground focus-visible:ring-ring/50 flex cursor-pointer items-center gap-1.5 rounded-sm text-[13px] font-medium outline-none focus-visible:ring-2 [&[data-panel-open]>svg]:rotate-0"
              type="button"
            />
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-3.5 -rotate-90 transition-transform"
            icon={ArrowDown01Icon}
          />
          {label}
        </CollapsibleTrigger>
        <OverviewHint field={label}>{t("hint")}</OverviewHint>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 pt-2">
          {totals.total === 0 ? (
            <AgentReachEmpty />
          ) : (
            <>
              <AgentReachStats
                totals={totals}
                trends={agentReachDailyVisitsByKind(
                  data,
                  AI_TRAFFIC_DEFAULT_DAYS
                )}
              />
              <ul className="px-4">
                {visibleEngines.map((engine) => (
                  <AgentReachEngineRow
                    engine={engine}
                    key={engine.key}
                    max={engines[0]?.total ?? 0}
                  />
                ))}
              </ul>
              {hiddenEngines > 0 ? (
                <p className="text-muted-foreground px-4 text-xs">
                  {t("more", { count: hiddenEngines })}
                </p>
              ) : null}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
