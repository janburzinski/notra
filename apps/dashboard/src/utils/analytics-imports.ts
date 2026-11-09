import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { isRecord } from "@notra/utils/unknown-record";
import type { useFormatter } from "use-intl";

import {
  ANALYTICS_IMPORT_AVERAGE_MONTH_DAYS,
  ANALYTICS_IMPORT_FILE_ERROR_DATA,
  ANALYTICS_IMPORT_SPAN_MIN_MONTH_DAYS,
} from "@/constants/analytics-imports";
import type {
  AnalyticsImportAddedRange,
  AnalyticsImportOverlapMode,
  AnalyticsImportPreview,
  AnalyticsImportSummary,
} from "@/types/analytics-imports";
import type {
  AnalyticsImportProviderChoice,
  AnalyticsImportView,
  ImportZipRootA11yProps,
} from "@/types/components/analytics-import";

/** A stored `YYYY-MM-DD` import day as the instant it starts in UTC. */
export function importDayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** A stored `YYYY-MM-DD` import day as a medium date, read in UTC. */
export function formatImportDay(
  format: ReturnType<typeof useFormatter>,
  day: string
): string {
  return format.dateTime(importDayDate(day), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/**
 * Why a dropped or chosen file was refused: more than one file, or one that
 * is not a ZIP within the size limit.
 */
export function zipRejectionReason(
  rejections: readonly { errors: readonly { code: string }[] }[]
): "tooManyFiles" | "rejected" {
  return rejections.some((rejection) =>
    rejection.errors.some((error) => error.code === "too-many-files")
  )
    ? "tooManyFiles"
    : "rejected";
}

export function isImportActive(status: string): boolean {
  return (ANALYTICS_IMPORT_ACTIVE_STATUSES as readonly string[]).includes(
    status
  );
}

/** Share of chunks done, 0–100; an import that has not planned yet shows 0. */
export function importProgress(
  chunksDone: number,
  chunksTotal: number
): number {
  if (chunksTotal <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((chunksDone / chunksTotal) * 100));
}

/** How long an import period lasts, in days or, from two months on, rounded months. */
export function importSpan(
  startDay: string,
  endDay: string
): { unit: "days" | "months"; count: number } {
  const days = (Date.parse(endDay) - Date.parse(startDay)) / 86_400_000 + 1;
  if (days < ANALYTICS_IMPORT_SPAN_MIN_MONTH_DAYS) {
    return { unit: "days", count: days };
  }
  return {
    unit: "months",
    count: Math.round(days / ANALYTICS_IMPORT_AVERAGE_MONTH_DAYS),
  };
}

/** The days a preview would import with the chosen overlap mode. */
export function previewRange(
  preview: AnalyticsImportPreview,
  overlap: AnalyticsImportOverlapMode
): AnalyticsImportAddedRange {
  if (overlap === "add" && preview.added) {
    return preview.added;
  }
  return {
    startDay: preview.startDay,
    endDay: preview.endDay,
    months: preview.months,
    pageviews: preview.pageviews,
    clipped: preview.clipped,
  };
}

/** Active imports and their combined progress, 0–1, for the background indicator. */
export function activeImportsProgress(
  imports: readonly AnalyticsImportSummary[]
): { count: number; share: number } {
  const active = imports.filter((item) => isImportActive(item.status));
  const total = active.reduce((sum, item) => sum + item.chunksTotal, 0);
  const done = active.reduce((sum, item) => sum + item.chunksDone, 0);
  return { count: active.length, share: total > 0 ? done / total : 0 };
}

/** The message of an error about the uploaded export itself, else null. */
export function importFileErrorMessage(error: unknown): string | null {
  if (
    error instanceof Error &&
    "data" in error &&
    isRecord(error.data) &&
    error.data.field === ANALYTICS_IMPORT_FILE_ERROR_DATA.field &&
    error.message
  ) {
    return error.message;
  }
  return null;
}

/** The step a picked provider opens: the export upload, or connecting an account. */
export function importStepFor(
  provider: AnalyticsImportProviderChoice
): AnalyticsImportView {
  return provider === "plausible_csv"
    ? { step: "csv" }
    : { step: "connect", provider };
}

/**
 * Empty, the drop zone is the button that opens the file picker; with a
 * file, it's a named group around Replace and Remove.
 */
export function importZipRootProps(
  hasFile: boolean,
  hasError: boolean,
  ids: { label: string; title: string; hint: string; error: string }
): ImportZipRootA11yProps {
  const describedBy = [hasFile ? null : ids.hint, hasError ? ids.error : null]
    .filter(Boolean)
    .join(" ");
  return {
    role: hasFile ? "group" : "button",
    "aria-labelledby": hasFile ? ids.label : `${ids.label} ${ids.title}`,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(hasError ? { "aria-invalid": true } : {}),
  };
}
