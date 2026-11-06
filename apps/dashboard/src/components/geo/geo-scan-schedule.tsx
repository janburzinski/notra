"use client";

import {
  GEO_SCAN_DEFAULT_INTERVAL_HOURS,
  GEO_SCAN_INTERVAL_OPTIONS,
} from "@notra/geo-core/constants/geo";
import { isGeoScanIntervalPreset } from "@notra/geo-core/utils/geo-scan";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { useGeoScanIntervalNoun } from "@/lib/hooks/use-geo-scan-interval-noun";
import type { GeoScanFrequencyMenuProps } from "@/types/geo";
import { geoScanIntervalMessageKey } from "@/utils/geo-scan-interval-key";

const SCAN_OFF_VALUE = "off";

/** Scan frequency as a submenu. A custom interval stays listed while set. */
export function GeoScanFrequencyMenu({
  enabled,
  intervalHours,
  onEnabledChange,
  onIntervalChange,
  disabled = false,
}: GeoScanFrequencyMenuProps) {
  const t = useTranslations("geo.geoScanSchedule");
  const tCommon = useTranslations("common");
  const intervalNoun = useGeoScanIntervalNoun();
  const intervalLabel = (hours: number): string => {
    const key = geoScanIntervalMessageKey(hours);
    if (key === "24") {
      return tCommon("labels.daily");
    }
    if (key === "168") {
      return tCommon("labels.weekly");
    }
    return key ? t(`short.${key}`) : intervalNoun(hours);
  };
  const custom = !isGeoScanIntervalPreset(intervalHours);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <span className="flex flex-1 items-center justify-between gap-4">
          {t("frequency")}
          <span className="text-muted-foreground">
            {enabled ? intervalLabel(intervalHours) : tCommon("labels.off")}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          onValueChange={(value: string) => {
            if (value === SCAN_OFF_VALUE) {
              onEnabledChange(false);
              return;
            }
            onEnabledChange(true);
            onIntervalChange(Number(value));
          }}
          value={enabled ? String(intervalHours) : SCAN_OFF_VALUE}
        >
          {GEO_SCAN_INTERVAL_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={String(option.value)}
            >
              <span>
                {intervalLabel(option.value)}
                {option.value === GEO_SCAN_DEFAULT_INTERVAL_HOURS ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({t("default")})
                  </span>
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
          {custom ? (
            <DropdownMenuRadioItem value={String(intervalHours)}>
              {intervalLabel(intervalHours)}
            </DropdownMenuRadioItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={SCAN_OFF_VALUE}>
            {tCommon("labels.off")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
