"use client";

import type { AnalyticsImportStatus } from "@notra/db/types/analytics-imports";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import {
  claimImportNotice,
  finishedSinceLastSeen,
} from "@/utils/analytics-import-watch";
import { formatImportDay } from "@/utils/analytics-imports";

/** Imports whose progress view is open; they need no toast. */
const shownProgress = new Set<string>();

/** Marks an import's progress as on screen while the calling view is mounted. */
export function useShownImportProgress(importId: string) {
  useEffect(() => {
    shownProgress.add(importId);
    return () => {
      shownProgress.delete(importId);
    };
  }, [importId]);
}

/**
 * Charts and import lists read again once an import finishes, so they
 * update without a reload; each import that finished out of sight gets one
 * notice.
 */
export async function settleFinishedImports(
  finished: readonly AnalyticsImportSummary[],
  {
    queryClient,
    notify,
    storage,
  }: {
    queryClient: QueryClient;
    notify: (item: AnalyticsImportSummary) => void;
    storage: Pick<Storage, "getItem" | "setItem"> | null;
  }
): Promise<void> {
  if (finished.length === 0) {
    return;
  }
  for (const item of finished) {
    if (!shownProgress.has(item.id) && claimImportNotice(item.id, storage)) {
      notify(item);
    }
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.geo.key() }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.analyticsImports.list.key(),
    }),
  ]);
}

/** Watches a list of imports and reacts when one finishes in the background. */
export function useAnalyticsImportNotices(
  imports: readonly AnalyticsImportSummary[] | undefined
) {
  const t = useTranslations("geo.analyticsImport.toast");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const seen = useRef(new Map<string, AnalyticsImportStatus>());

  useEffect(() => {
    if (!imports) {
      return;
    }
    const finished = finishedSinceLastSeen(seen.current, imports);
    void settleFinishedImports(finished, {
      queryClient,
      storage: typeof window === "undefined" ? null : window.localStorage,
      notify: (item) => {
        if (item.status === "completed") {
          toast.success(t("completed", { host: item.host }), {
            description: item.startDay
              ? t("completedDescription", {
                  date: formatImportDay(format, item.startDay),
                })
              : undefined,
          });
          return;
        }
        toast.error(t("failed", { host: item.host }), {
          description: t("failedDescription"),
        });
      },
    });
  }, [imports, queryClient, t, format]);
}
