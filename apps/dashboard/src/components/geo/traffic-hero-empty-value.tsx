import { TRAFFIC_HERO_METRIC_VALUE_CLASS } from "@/constants/geo-traffic-hero";
import { cn } from "@/lib/utils";
import type { TrafficHeroEmptyValueProps } from "@/types/geo";

/** A hero metric that has no value: a dash, why, and how to get one. */
export function TrafficHeroEmptyValue({
  hint,
  action,
}: TrafficHeroEmptyValueProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 self-start @sm/hero:gap-3">
      <span
        aria-hidden="true"
        className={cn("text-muted-foreground", TRAFFIC_HERO_METRIC_VALUE_CLASS)}
        title={hint}
      >
        —
      </span>
      <span className="sr-only">{hint}</span>
      {action}
    </div>
  );
}
