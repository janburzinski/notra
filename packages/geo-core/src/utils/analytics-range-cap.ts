import type { ZodType } from "zod";

import {
  ANALYTICS_MAX_RANGE_DAYS,
  ISO_DATE_LENGTH,
} from "../constants/web-analytics";

const DAY_MS = 86_400_000;

function utcDay(value: string): number | null {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, ISO_DATE_LENGTH) !== value
    ? null
    : time;
}

/**
 * Rejects impossible days (`2026-02-31` used to read as no data), a `from`
 * after `to` and spans over {@link ANALYTICS_MAX_RANGE_DAYS}. An open `to`
 * runs to today, so an old `from` alone cannot ask for years of data
 * either. Apply it last: zod objects with refinements cannot be extended.
 */
export function withAnalyticsRangeCap<
  T extends ZodType<{ from?: string; to?: string }>,
>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const from = value.from === undefined ? null : utcDay(value.from);
    const to = value.to === undefined ? null : utcDay(value.to);
    if (value.from !== undefined && from === null) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "Not a real day",
      });
    }
    if (value.to !== undefined && to === null) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Not a real day" });
    }
    if (from === null) {
      return;
    }
    const end = to ?? Date.now();
    if (end < from) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be on or before to",
      });
      return;
    }
    if (Math.floor((end - from) / DAY_MS) + 1 > ANALYTICS_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: `A range can cover at most ${ANALYTICS_MAX_RANGE_DAYS} days`,
      });
    }
  });
}
