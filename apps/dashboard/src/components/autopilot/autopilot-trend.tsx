import { TrendBadge } from "@notra/ui/components/trend-badge";

import type { AutopilotTrendProps } from "@/types/autopilot";

/** The change against the period before; nothing when both are empty. */
export function AutopilotTrend({
  current,
  previous,
  higherIsBetter = true,
  neutral = false,
}: AutopilotTrendProps) {
  if (previous === undefined || (current === 0 && previous === 0)) {
    return null;
  }
  const change = Math.round((current - previous) * 10) / 10;
  let tone: "up" | "down" | "flat" = "flat";
  if (change !== 0 && !neutral) {
    tone = change > 0 === higherIsBetter ? "up" : "down";
  }
  return (
    <TrendBadge showIcon={!neutral} tone={tone}>
      {change > 0 ? `+${change}` : change}
    </TrendBadge>
  );
}
