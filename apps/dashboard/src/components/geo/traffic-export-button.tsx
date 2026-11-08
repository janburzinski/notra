"use client";

import { FileExportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { TrafficExportButtonProps } from "@/types/geo";
import { downloadTrafficCsv } from "@/utils/traffic-export";

export function TrafficExportButton({
  traffic,
  web,
  range,
  path,
}: TrafficExportButtonProps) {
  const t = useTranslations("geo.trafficExport");
  const disabled = traffic === undefined || web === undefined;

  return (
    <Button
      disabled={disabled}
      onClick={() => {
        if (traffic && web) {
          downloadTrafficCsv(traffic, web, range, path);
        }
      }}
      size="sm"
      variant="secondary"
    >
      <HugeiconsIcon
        className="text-muted-foreground size-3.5"
        icon={FileExportIcon}
      />
      {t("label")}
    </Button>
  );
}
