import type {
  ImportDayRange,
  ImportRangeInput,
} from "../types/analytics-imports";

const DAY_MS = 86_400_000;
/** Tinybird answers min() over no rows with this day. */
export const NATIVE_EPOCH_DAY = "1970-01-01";

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

/**
 * Imports stop the day before native tracking starts (Plausible's rule), so
 * no day is ever counted twice. Without native data yet, they stop yesterday.
 * Tinybird answers min() over no rows with 1970-01-01.
 */
export function importCutoffDay(
  firstNativeDays: readonly (string | null | undefined)[],
  today: string
): string {
  const days = firstNativeDays.filter(
    (day): day is string => Boolean(day) && day !== NATIVE_EPOCH_DAY
  );
  const first = days.toSorted()[0];
  return first && first < today ? first : today;
}

export function earliestDayForLookback(
  lookbackDays: number | null,
  today: string
): string | null {
  return lookbackDays === null ? null : addDays(today, -(lookbackDays - 1));
}

/**
 * Resolves the days an import may write: inside the request, the provider's
 * retention and before the cut-off, minus days other imports already cover.
 * When coverage splits the range, the newest uncovered stretch wins.
 */
export function resolveImportRange(
  input: ImportRangeInput
): ImportDayRange | null {
  let end = addDays(input.cutoffDay, -1);
  if (input.requestedEnd && input.requestedEnd < end) {
    end = input.requestedEnd;
  }
  let start = input.requestedStart ?? input.earliestDay ?? null;
  if (input.earliestDay && start && start < input.earliestDay) {
    start = input.earliestDay;
  }
  const covered = input.covered.toSorted((a, b) => b.end.localeCompare(a.end));
  for (const range of covered) {
    if (start && end < start) {
      break;
    }
    if (range.start <= end && range.end >= end) {
      end = addDays(range.start, -1);
    }
  }
  for (const range of covered) {
    if (range.end < end && (!start || range.end >= start)) {
      start = addDays(range.end, 1);
      break;
    }
  }
  if (!start) {
    return null;
  }
  return start <= end ? { start, end } : null;
}

/** The days of `range` each covered range shares with it, in the given order; ranges without shared days are dropped. */
export function sharedDays<T extends ImportDayRange>(
  range: ImportDayRange,
  covered: readonly T[]
): T[] {
  return covered.flatMap((item) => {
    const start = item.start > range.start ? item.start : range.start;
    const end = item.end < range.end ? item.end : range.end;
    return start <= end ? [{ ...item, start, end }] : [];
  });
}

/** Calendar-month chunks inside the range, newest first. */
export function monthChunks(range: ImportDayRange): ImportDayRange[] {
  const chunks: ImportDayRange[] = [];
  let end = range.end;
  while (end >= range.start) {
    const monthStart = `${end.slice(0, 7)}-01`;
    const start = monthStart < range.start ? range.start : monthStart;
    chunks.push({ start, end });
    end = addDays(monthStart, -1);
  }
  return chunks;
}

/** Month chunks, newest first, each split into windows of at most `maxDays`. */
export function importChunks(
  range: ImportDayRange,
  maxDays?: number
): ImportDayRange[] {
  if (!maxDays) {
    return monthChunks(range);
  }
  return monthChunks(range).flatMap((month) => {
    const windows: ImportDayRange[] = [];
    for (let end = month.end; end >= month.start;) {
      const earliest = addDays(end, -(maxDays - 1));
      const start = earliest < month.start ? month.start : earliest;
      windows.push({ start, end });
      end = addDays(start, -1);
    }
    return windows;
  });
}

/**
 * Splits the range at day boundaries, newest first, so no chunk holds more
 * than `maxWeight` (a single heavier day is a chunk of its own).
 */
export function weightedChunks(
  range: ImportDayRange,
  weights: Readonly<Record<string, number>>,
  maxWeight: number
): ImportDayRange[] {
  const chunks: ImportDayRange[] = [];
  let end = range.end;
  let total = 0;
  for (let day = range.end; day >= range.start; day = addDays(day, -1)) {
    const weight = weights[day] ?? 0;
    if (total > 0 && total + weight > maxWeight) {
      chunks.push({ start: addDays(day, 1), end });
      end = day;
      total = 0;
    }
    total += weight;
  }
  chunks.push({ start: range.start, end });
  return chunks;
}

function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS;
}

/**
 * Page views inside a range, from counts per day ("2026-08-01") or per month
 * ("2026-08"). A month only partly inside the range counts pro rata.
 */
export function pageviewsInRange(
  counts: Readonly<Record<string, number>>,
  range: ImportDayRange
): number {
  const from = dayNumber(range.start);
  const to = dayNumber(range.end);
  let total = 0;
  for (const [key, count] of Object.entries(counts)) {
    const month = key.length === 7;
    const first = dayNumber(month ? `${key}-01` : key);
    const last = month
      ? Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0) / DAY_MS
      : first;
    const shared = Math.min(last, to) - Math.max(first, from) + 1;
    if (shared > 0) {
      total += (count * shared) / (last - first + 1);
    }
  }
  return Math.round(total);
}

export function daysInRange(range: ImportDayRange): string[] {
  const days: string[] = [];
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}
