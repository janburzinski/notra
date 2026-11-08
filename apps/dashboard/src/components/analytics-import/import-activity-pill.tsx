"use client";

import { DatabaseImportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import type { ImportActivityPillProps } from "@/types/components/analytics-import";
import { activeImportsProgress } from "@/utils/analytics-imports";

/**
 * A quiet note that imports keep running in the background, with their
 * combined progress; it opens the import dialog. Hidden while nothing runs.
 */
export function ImportActivityPill({
  imports,
  onOpen,
  className,
}: ImportActivityPillProps) {
  const t = useTranslations("geo.analyticsImport.indicator");
  const format = useFormatter();
  const { count, share } = activeImportsProgress(imports);
  if (count === 0) {
    return null;
  }
  const label = t("label", {
    count,
    percent: format.number(share, {
      style: "percent",
      maximumFractionDigits: 0,
    }),
  });
  return (
    <Button
      aria-label={`${label}. ${t("open")}`}
      className={cn("max-w-full min-w-0", className)}
      onClick={onOpen}
      size="sm"
      variant="secondary"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="text-primary size-3.5 shrink-0"
        icon={DatabaseImportIcon}
        strokeWidth={1.75}
      />
      <span className="truncate tabular-nums">{label}</span>
      <span
        aria-hidden="true"
        className="bg-foreground/10 ms-0.5 h-1 w-8 shrink-0 overflow-hidden rounded-full"
      >
        <span
          className="bg-primary block h-full w-full origin-left scale-x-(--import-share) rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ "--import-share": share } as CSSProperties}
        />
      </span>
    </Button>
  );
}
