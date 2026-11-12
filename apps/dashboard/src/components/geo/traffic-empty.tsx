"use client";

import { AiBrowserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { useTranslations } from "use-intl";

import { GeoIngestSetup } from "@/components/geo/geo-ingest-setup";
import type { TrafficEmptyProps } from "@/types/geo";

export function TrafficEmpty({
  setup,
  defaultMethod,
  description,
}: TrafficEmptyProps) {
  const t = useTranslations("geo.trafficEmpty");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AiBrowserIcon} />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{description ?? t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl items-stretch text-left">
        <GeoIngestSetup defaultMethod={defaultMethod} setup={setup} />
      </EmptyContent>
    </Empty>
  );
}
