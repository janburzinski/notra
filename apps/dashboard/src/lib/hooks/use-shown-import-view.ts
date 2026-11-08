"use client";

import { useState } from "react";

import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import type { AnalyticsImportView } from "@/types/components/analytics-import";
import { shownImport } from "@/utils/analytics-import-progress";

/**
 * The dialog's view with the progress step's import taken from the polled
 * list, which is fresher than what the start call returned. Once the list
 * had the import, losing it means the import was deleted.
 */
export function useShownImportView(
  view: AnalyticsImportView,
  imports: readonly AnalyticsImportSummary[] | undefined
): AnalyticsImportView {
  const [lastSeen, setLastSeen] = useState<AnalyticsImportSummary | null>(null);
  const listed =
    view.step === "progress"
      ? imports?.find((entry) => entry.id === view.item.id)
      : undefined;
  if (listed && listed !== lastSeen) {
    setLastSeen(listed);
  }
  return view.step === "progress"
    ? { step: "progress", item: shownImport(view.item, imports, lastSeen) }
    : view;
}
