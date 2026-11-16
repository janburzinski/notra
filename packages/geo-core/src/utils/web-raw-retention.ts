import { WEB_RAW_RETENTION_DAYS } from "@notra/analytics/constants/web-queries";

import { ISO_DATE_LENGTH } from "../constants/web-analytics";

const DAY_MS = 86_400_000;

function utcDay(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

/** The first whole day the raw web rows still hold. */
function firstKeptDay(now: Date): number {
  const today = utcDay(now.toISOString().slice(0, ISO_DATE_LENGTH));
  return today - (WEB_RAW_RETENTION_DAYS - 1) * DAY_MS;
}

/**
 * Whether the raw web rows still cover the previous period of a window, as
 * the pipes compute it: the same number of days right before `date_from`, or
 * `days * 2` days back without one. Rows are kept for
 * {@link WEB_RAW_RETENTION_DAYS} days, so a day is whole only from
 * `today - (retention - 1)` on. Days up to `importedUntil` come from a
 * completed import, which never expires, so only the days after it must be
 * kept. Without the check, a report that reads raw rows compared with an
 * empty period and showed every row as "New".
 */
export function rawWebPreviousKept(
  params: { days: number; date_from: string; date_to: string },
  now = new Date(),
  importedUntil?: string
): boolean {
  const today = utcDay(now.toISOString().slice(0, ISO_DATE_LENGTH));
  let previousStart: number;
  let previousEnd: number;
  if (params.date_from) {
    const from = utcDay(params.date_from);
    const to = params.date_to ? utcDay(params.date_to) : today;
    previousStart = from - (to - from + DAY_MS);
    previousEnd = from - DAY_MS;
  } else {
    previousStart = today - params.days * 2 * DAY_MS;
    previousEnd = today - (params.days + 1) * DAY_MS;
  }
  const rawStart = importedUntil
    ? Math.max(previousStart, utcDay(importedUntil) + DAY_MS)
    : previousStart;
  return rawStart > previousEnd || rawStart >= firstKeptDay(now);
}

/**
 * Whether a range starts before the raw web rows do, so reports that read
 * them (every breakdown filtered to one page) cover only its last part.
 */
export function startsBeforeRawWebRetention(
  from: string,
  now = new Date()
): boolean {
  return utcDay(from) < firstKeptDay(now);
}
