import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter } from "use-intl";

import { cn } from "@/lib/utils";
import type { AutopilotFindingStepsProps } from "@/types/autopilot";
import { findingStepLabel } from "@/utils/autopilot-events";

/** A compact activity list; technical metadata remains on the linked run. */
export function AutopilotFindingSteps({ events }: AutopilotFindingStepsProps) {
  const format = useFormatter();
  return (
    <ol aria-label="Decision steps" className="divide-y">
      {events.map((event) => {
        const failed = event.level === "error";
        return (
          <li
            className="flex items-start gap-3 px-4 py-3 text-sm"
            key={event.id}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0",
                failed ? "text-destructive" : "text-muted-foreground"
              )}
              icon={failed ? Cancel01Icon : CheckmarkCircle02Icon}
              strokeWidth={1.5}
            />
            <span className="min-w-0 flex-1 break-words">
              {failed ? <span className="sr-only">Error: </span> : null}
              {findingStepLabel(event.message)}
            </span>
            <time
              className="text-muted-foreground shrink-0 text-xs tabular-nums"
              dateTime={new Date(event.createdAt).toISOString()}
            >
              {format.dateTime(new Date(event.createdAt), {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
