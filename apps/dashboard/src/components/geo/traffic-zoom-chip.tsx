"use client";

import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { TrafficZoomChipProps } from "@/types/geo";

export function TrafficZoomChip({
  rows,
  zoomed,
  onReset,
}: TrafficZoomChipProps) {
  const t = useTranslations("geo.trafficHero");
  if (!zoomed) {
    return null;
  }
  return (
    <Button onClick={onReset} size="sm" variant="outline">
      {rows[0]?.day} – {rows.at(-1)?.day}
      <span className="text-muted-foreground">{t("resetZoom")}</span>
    </Button>
  );
}
