"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useMemo } from "react";
import { useLocale } from "use-intl";

import {
  AUTOPILOT_RUN_DAY_CLASS,
  AUTOPILOT_RUN_DAY_LABELS,
} from "@/constants/autopilot-run-history";
import { cn } from "@/lib/utils";
import type { AutopilotRunHistoryProps } from "@/types/autopilot-metrics";

/**
 * One bar per day, today last: a tall pill when the automation opened a pull
 * request (red when it failed), a short dash when it ran or didn't. Each day
 * says its date and what happened on hover.
 */
export function AutopilotRunHistory({ days }: AutopilotRunHistoryProps) {
  const locale = useLocale();
  // The dates are calendar days already, so format them as UTC to keep the
  // viewer's own time zone from moving them a day.
  const format = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [locale]
  );
  return (
    <span className="flex h-5.5 items-end">
      {days.map((day, index) => {
        const date =
          index === days.length - 1
            ? "Today"
            : format.format(new Date(`${day.date}T00:00:00Z`));
        const label = `${date}: ${AUTOPILOT_RUN_DAY_LABELS[day.state]}`;
        return (
          <Tooltip key={day.date}>
            <TooltipTrigger
              aria-label={label}
              // The whole column is the hover target, not just the dash.
              render={
                <span className="flex h-full items-end px-0.5" role="img" />
              }
            >
              <span
                className={cn(
                  "w-2 shrink-0 rounded-full",
                  AUTOPILOT_RUN_DAY_CLASS[day.state]
                )}
              />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
