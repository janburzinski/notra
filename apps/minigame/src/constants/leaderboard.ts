import type { BoardPeriod } from "@/types/leaderboard";

/** A company scores the all-time bests of this many of its pilots, so headcount alone doesn't win. */
export const COMPANY_TOP_PILOTS = 5;

export const BOARD_PERIODS: readonly { value: BoardPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
];

/** How old a board fetched ahead of time may be when the leaderboard opens; the CDN caches it as long. */
export const PREFETCH_MAX_AGE_MS = 15_000;
