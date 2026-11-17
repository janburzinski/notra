"use client";

import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import {
  TRAFFIC_HERO_METRIC_VALUE_CLASS,
  TRAFFIC_HERO_TILE_BUTTON_CLASS,
  TRAFFIC_HERO_TILE_CLASS,
  TRAFFIC_HERO_TILE_MUTED_CLASS,
} from "@/constants/geo-traffic-hero";
import type { TrafficHeroTileProps } from "@/types/geo";

/** A headline total whose label switches the hero chart to its own trend. */
export function TrafficHeroTile({
  label,
  value,
  delta,
  lowerIsBetter,
  selected,
  onSelect,
}: TrafficHeroTileProps) {
  const tShared = useTranslations("geo.shared");
  return (
    <div
      className={TRAFFIC_HERO_TILE_CLASS}
      data-selected={selected ? "" : undefined}
    >
      <button
        aria-pressed={selected}
        className={cn(
          TRAFFIC_HERO_TILE_BUTTON_CLASS,
          selected ? "text-foreground" : TRAFFIC_HERO_TILE_MUTED_CLASS
        )}
        onClick={onSelect}
        type="button"
      >
        {label}
      </button>
      <div className="flex max-w-full min-w-0 flex-col items-start gap-2 self-start @3xl/hero:flex-row @3xl/hero:items-center @3xl/hero:gap-3">
        <span
          className={cn(
            TRAFFIC_HERO_METRIC_VALUE_CLASS,
            !selected && TRAFFIC_HERO_TILE_MUTED_CLASS
          )}
        >
          {value}
        </span>
        {delta === undefined ? null : (
          <span className="relative z-10 inline-flex">
            <GeoStatDelta
              delta={delta}
              hint={tShared("vsPreviousPeriodOfThe")}
              label={label}
              lowerIsBetter={lowerIsBetter}
            />
          </span>
        )}
      </div>
    </div>
  );
}
