"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  ANALYTICS_IMPORT_PROVIDER_BRANDS,
  ANALYTICS_IMPORT_PROVIDER_LABELS,
} from "@/constants/analytics-imports";
import { useImportProgressTitle } from "@/lib/hooks/use-import-progress-title";
import type { ImportDialogHeaderProps } from "@/types/components/analytics-import";

import { ImportProviderMark } from "./import-provider-mark";

export function ImportDialogHeader({
  view,
  onBack,
  backRef,
}: ImportDialogHeaderProps) {
  const t = useTranslations("geo.analyticsImport");
  const progressTitle = useImportProgressTitle();
  const header = (() => {
    switch (view.step) {
      case "csv":
        return {
          provider: "plausible_csv" as const,
          title: t("csv.title"),
          description: t("csv.description"),
        };
      case "connect":
        return {
          provider: view.provider,
          title: t("connect.title", {
            provider: ANALYTICS_IMPORT_PROVIDER_BRANDS[view.provider],
          }),
          description: t(`connect.description.${view.provider}`),
        };
      case "source":
        return {
          provider: view.provider,
          title: t("source.title"),
          description: t("source.description", {
            provider: ANALYTICS_IMPORT_PROVIDER_BRANDS[view.provider],
          }),
        };
      case "progress":
        return {
          provider: view.item.provider,
          title: progressTitle(view.item),
          description: ANALYTICS_IMPORT_PROVIDER_LABELS[view.item.provider],
        };
      default:
        return {
          provider: null,
          title: t("title"),
          description: t("description"),
        };
    }
  })();

  return (
    <ResponsiveDialogHeader className="text-start">
      {/* One title line tall, so the row centres on the close button. */}
      <div className="flex min-h-4 items-center gap-2 pe-8">
        {view.step === "home" ? null : (
          <Button
            aria-label={t("back")}
            className="-ms-2 shrink-0"
            onClick={onBack}
            ref={backRef}
            size="icon-sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
        )}
        {header.provider ? (
          <ImportProviderMark provider={header.provider} />
        ) : null}
        <ResponsiveDialogTitle>{header.title}</ResponsiveDialogTitle>
      </div>
      <ResponsiveDialogDescription>
        {header.description}
      </ResponsiveDialogDescription>
    </ResponsiveDialogHeader>
  );
}
