"use client";

import { PackageIcon, SourceCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cloudflare } from "@notra/ui/components/ui/svgs/cloudflare";
import { Vercel } from "@notra/ui/components/ui/svgs/vercel";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import type {
  GeoIngestMethodIconProps,
  GeoIngestMethodPickerProps,
} from "@/types/geo";
import { isGeoIngestMethod } from "@/utils/geo-ingest";

function GeoIngestMethodIcon({ method }: GeoIngestMethodIconProps) {
  switch (method) {
    case "script":
      return (
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={SourceCodeIcon}
        />
      );
    case "sdk":
      return (
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={PackageIcon}
        />
      );
    case "vercel":
      return <Vercel aria-hidden="true" className="size-3" />;
    case "cloudflare":
      return <Cloudflare aria-hidden="true" className="h-3 w-auto" />;
    default:
      return null;
  }
}

/** The install methods as small tabs. */
export function GeoIngestMethodPicker({
  value,
  methods,
  onChange,
}: GeoIngestMethodPickerProps) {
  const t = useTranslations("geo.geoIngestSetup");
  return (
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
            {/* Four labels fill a phone's width; the logos come back at sm. */}
            <span className="hidden sm:contents">
              <GeoIngestMethodIcon method={method} />
            </span>
            {t(`methods.${method}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
