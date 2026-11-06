"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useLocale, useTranslations } from "use-intl";

import type { AgentReachCellProps } from "@/types/content/agent-reach";

export function CollectionAgentReachCell({
  reach,
  loading,
  failed,
}: AgentReachCellProps) {
  const t = useTranslations("content.collections.agentReach");
  const locale = useLocale();
  if (loading) {
    return <Skeleton className="ml-auto h-3.5 w-8" />;
  }
  if (failed || reach?.unavailable) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              aria-label={t("unavailable")}
              className="text-muted-foreground"
            />
          }
        >
          —
        </TooltipTrigger>
        <TooltipContent>{t("unavailable")}</TooltipContent>
      </Tooltip>
    );
  }
  if (!reach) {
    return (
      <span aria-label={t("notLive")} className="text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={
              reach.total === 0
                ? "text-muted-foreground tabular-nums"
                : "text-foreground tabular-nums"
            }
          />
        }
      >
        {reach.total.toLocaleString(locale)}
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 tabular-nums">
          <div>{t("crawler", { count: reach.crawler })}</div>
          <div>{t("aiReferral", { count: reach.aiReferral })}</div>
          {reach.posts > 1 ? (
            <div className="text-muted-foreground">
              {t("posts", { count: reach.posts })}
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
