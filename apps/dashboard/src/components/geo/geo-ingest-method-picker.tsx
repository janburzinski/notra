"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import type { GeoIngestMethodPickerProps } from "@/types/geo";
import { isGeoIngestMethod } from "@/utils/geo-ingest";

/** The install methods as small tabs, with one line on what the picked one counts. */
export function GeoIngestMethodPicker({
  value,
  methods,
  onChange,
}: GeoIngestMethodPickerProps) {
  const t = useTranslations("geo.geoIngestSetup");
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Tabs
        onValueChange={(next) => {
          if (typeof next === "string" && isGeoIngestMethod(next)) {
            onChange(next);
          }
        }}
        value={value}
      >
        <TabsList aria-label={t("method")} className="w-full sm:w-fit">
          {methods.map((method) => (
            <TabsTrigger
              className="min-w-0 sm:flex-none"
              key={method}
              value={method}
            >
              {t(`methods.${method}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-muted-foreground text-sm text-pretty">
        {t(`methodDescriptions.${value}`)}
      </p>
    </div>
  );
}
