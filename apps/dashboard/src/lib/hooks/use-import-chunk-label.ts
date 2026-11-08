"use client";

import { useFormatter } from "use-intl";

import type { AnalyticsImportChunkSegment } from "@/types/analytics-imports";
import { isWholeMonth } from "@/utils/analytics-import-progress";
import { importDayDate } from "@/utils/analytics-imports";

/** "September 2026" for a whole month, "Sep 8 – 14, 2026" for anything shorter or longer. */
export function useImportChunkLabel() {
  const format = useFormatter();
  return (
    segment: Pick<AnalyticsImportChunkSegment, "start" | "end"> | null
  ) => {
    if (!(segment?.start && segment.end)) {
      return null;
    }
    if (isWholeMonth(segment.start, segment.end)) {
      return format.dateTime(importDayDate(segment.start), {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    return format.dateTimeRange(
      importDayDate(segment.start),
      importDayDate(segment.end),
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }
    );
  };
}
