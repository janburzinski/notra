import { formatSeconds } from "@/utils/site-charts";

export function formatResponseTime(ms: number | null): string {
  if (ms === null) {
    return "—";
  }
  const seconds = ms / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : formatSeconds(seconds);
}

export function formatPercent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}
