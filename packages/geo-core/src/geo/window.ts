import { ISO_DATE_LENGTH } from "../constants/web-analytics";
import type { GeoWindowInput } from "../types/geo";

const DAY_MS = 24 * 60 * 60 * 1000;

export function geoWindow(input: {
  days?: number;
  from?: string;
  to?: string;
}): GeoWindowInput {
  return { days: input.days, from: input.from, to: input.to };
}

/**
 * Pipe parameters for a window. "Last N days" is today and the N - 1 UTC
 * days before it, sent as a start date: the pipes' own `days` branch also
 * counted the day N days ago, so 7 days covered 8 and was compared with a
 * previous period of 7 (+14% on flat traffic).
 */
export function geoTrafficWindowParams(
  window: GeoWindowInput,
  fallbackDays: number,
  now = new Date()
): { days: number; date_from: string; date_to: string } {
  const days = window.days ?? fallbackDays;
  return {
    days,
    date_from:
      window.from ??
      new Date(now.getTime() - (days - 1) * DAY_MS)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH),
    date_to: window.to ?? "",
  };
}
