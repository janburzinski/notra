"use client";

import { ResponsiveDialogFooter } from "@notra/ui/components/shared/responsive-dialog";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import type { ImportHomeStepProps } from "@/types/components/analytics-import";

import { ImportList } from "./import-list";
import { ImportProviderPicker } from "./import-provider-picker";

export function ImportHomeStep({
  isPending,
  manageOnly,
  onPick,
  ...list
}: ImportHomeStepProps) {
  const t = useTranslations("geo.analyticsImport");

  return (
    <>
      {/* Imports, then where to import from; saved accounts last, they're upkeep. */}
      <div className="flex min-w-0 flex-col gap-6">
        {isPending ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : (
          <ImportList {...list} connections={[]} />
        )}
        {manageOnly ? null : <ImportProviderPicker onPick={onPick} />}
        {isPending ? null : <ImportList {...list} imports={[]} />}
      </div>
      <ResponsiveDialogFooter className="sm:justify-start">
        <p className="text-muted-foreground text-xs text-pretty">
          {t("privacy")}
        </p>
      </ResponsiveDialogFooter>
    </>
  );
}
