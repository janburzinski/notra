"use client";

import { useTranslations } from "use-intl";

import {
  ANALYTICS_IMPORT_PROGRESS_PHASES,
  ANALYTICS_IMPORT_PROGRESS_TITLES,
} from "@/constants/analytics-import-progress";
import type { AnalyticsImportSummary } from "@/types/analytics-imports";

/** The progress dialog's title for an import: "Importing acme.com", "Imported acme.com", … */
export function useImportProgressTitle() {
  const t = useTranslations("geo.analyticsImport.progress");
  return (item: Pick<AnalyticsImportSummary, "status" | "host">) =>
    t(
      ANALYTICS_IMPORT_PROGRESS_TITLES[
        ANALYTICS_IMPORT_PROGRESS_PHASES[item.status]
      ],
      { host: item.host }
    );
}
