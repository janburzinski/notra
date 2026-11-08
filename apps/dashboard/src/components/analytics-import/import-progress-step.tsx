"use client";

import { ANALYTICS_IMPORT_PROGRESS_PHASES } from "@/constants/analytics-import-progress";
import { useShownImportProgress } from "@/lib/hooks/use-analytics-import-notices";
import { useViewImportedAnalytics } from "@/lib/hooks/use-view-imported-analytics";
import type { ImportProgressStepProps } from "@/types/components/analytics-import";

import { ImportProgressFooter } from "./import-progress-parts";
import { ImportProgressView } from "./import-progress-view";

/** One import from "Start import" until it finished, stopped or was deleted. */
export function ImportProgressStep({
  item,
  onClose,
  onBack,
  onImportAnother,
}: ImportProgressStepProps) {
  const viewAnalytics = useViewImportedAnalytics();
  useShownImportProgress(item.id);
  return (
    <>
      {/* The phone sheet pads its body's direct children, not the card itself. */}
      <div className="flex min-w-0 flex-col">
        <ImportProgressView item={item} />
      </div>
      <ImportProgressFooter
        onBack={onBack}
        onClose={onClose}
        onImportAnother={onImportAnother}
        onViewAnalytics={() => {
          onClose();
          viewAnalytics(item);
        }}
        phase={ANALYTICS_IMPORT_PROGRESS_PHASES[item.status]}
      />
    </>
  );
}
