"use client";

import { ResponsiveDialogFooter } from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ANALYTICS_IMPORT_ENDED_PHASES } from "@/constants/analytics-import-progress";
import type { ImportProgressFooterProps } from "@/types/components/analytics-import";

/** Close while it runs; a clear next step once it finished, stopped or was deleted. */
export function ImportProgressFooter({
  phase,
  onClose,
  onViewAnalytics,
  onBack,
  onImportAnother,
}: ImportProgressFooterProps) {
  const t = useTranslations("geo.analyticsImport.progress");
  const importAnother = onImportAnother ? (
    <Button onClick={onImportAnother} variant="ghost">
      {t("importAnother")}
    </Button>
  ) : null;
  if (phase === "completed") {
    return (
      // Two actions only; the back arrow already leads to another import.
      <ResponsiveDialogFooter>
        <Button onClick={onClose} variant="outline">
          {t("done")}
        </Button>
        <Button data-dialog-confirm onClick={onViewAnalytics}>
          {t("viewAnalytics")}
        </Button>
      </ResponsiveDialogFooter>
    );
  }
  if (ANALYTICS_IMPORT_ENDED_PHASES.has(phase)) {
    return (
      <ResponsiveDialogFooter>
        <Button onClick={onBack} variant="outline">
          {t("backToImports")}
        </Button>
      </ResponsiveDialogFooter>
    );
  }
  return (
    <ResponsiveDialogFooter>
      {importAnother}
      <Button onClick={onClose} variant="outline">
        {t("close")}
      </Button>
    </ResponsiveDialogFooter>
  );
}
