import { TrendBadge } from "@notra/ui/components/trend-badge";
import { Badge } from "@notra/ui/components/ui/badge";

import type { DataTrendValue } from "@/types/data";

/**
 * Week-over-week change as the shared TrendBadge, signed like the badge
 * showcase. New entries get "New".
 */
export function DataTrend({ trend }: { trend: DataTrendValue }) {
  if (trend.value === null) {
    return (
      <Badge shape="rounded" variant="info">
        New
      </Badge>
    );
  }
  let tone: "up" | "down" | "flat" = "flat";
  if (trend.value > 0) {
    tone = "up";
  } else if (trend.value < 0) {
    tone = "down";
  }
  return <TrendBadge tone={tone}>{trend.signed}</TrendBadge>;
}
