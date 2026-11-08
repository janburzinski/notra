import type { AnalyticsImportStatus } from "@notra/db/types/analytics-imports";

import {
  ANALYTICS_IMPORT_NOTICE_STORAGE_KEY,
  ANALYTICS_IMPORT_NOTICE_STORAGE_MAX,
} from "@/constants/analytics-imports";
import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import { isImportActive } from "@/utils/analytics-imports";

/**
 * Records each import's status and returns the ones that were seen active
 * and have now completed or failed. An import first seen finished is never
 * returned, so loading a page doesn't announce old imports.
 */
export function finishedSinceLastSeen(
  seen: Map<string, AnalyticsImportStatus>,
  imports: readonly AnalyticsImportSummary[]
): AnalyticsImportSummary[] {
  const finished: AnalyticsImportSummary[] = [];
  for (const item of imports) {
    const before = seen.get(item.id);
    if (
      before &&
      isImportActive(before) &&
      (item.status === "completed" || item.status === "failed")
    ) {
      finished.push(item);
    }
    seen.set(item.id, item.status);
  }
  return finished;
}

/**
 * Claims the one notice an import gets, across tabs and reloads. Without
 * storage every tab claims it; a duplicate toast is better than none.
 */
export function claimImportNotice(
  importId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null
): boolean {
  if (!storage) {
    return true;
  }
  try {
    const raw = storage.getItem(ANALYTICS_IMPORT_NOTICE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const claimed = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
    if (claimed.includes(importId)) {
      return false;
    }
    storage.setItem(
      ANALYTICS_IMPORT_NOTICE_STORAGE_KEY,
      JSON.stringify(
        [...claimed, importId].slice(-ANALYTICS_IMPORT_NOTICE_STORAGE_MAX)
      )
    );
    return true;
  } catch {
    return true;
  }
}
