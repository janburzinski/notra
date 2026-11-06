"use client";

import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";

import { ReportPanel } from "@/components/state-of-ai-search/report-section";
import {
  DATA_HEAT_FLOOR,
  DATA_TOOLTIP_CLASS,
  DATA_WEEKDAYS,
} from "@/constants/data";
import type { DataHourGrid, DataTrafficKind } from "@/types/data";
import { formatShare } from "@/utils/data";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_TICKS = new Set([0, 6, 12, 18]);
const HOURS_PER_WEEK = 168;
const LAST_HOUR = 23;

const HEAT = {
  crawlers: "[--heat:#7C3AED] dark:[--heat:#A78BFA]",
  referrals: "[--heat:#D97706] dark:[--heat:#FFB547]",
} as const;

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function busiestCell(grid: DataHourGrid): { day: number; hour: number } {
  let best = { day: 0, hour: 0, value: -1 };
  for (const [day, row] of grid.entries()) {
    for (const [hour, value] of row.entries()) {
      if (value > best.value) {
        best = { day, hour, value };
      }
    }
  }
  return best;
}

/**
 * Heat runs from the quietest to the busiest hour, not from zero, so the
 * week's shape stays visible even when traffic never stops.
 */
function heatStrength(value: number, min: number, max: number): number {
  const spread = max - min;
  const position = spread > 0 ? (value - min) / spread : 1;
  return DATA_HEAT_FLOOR + position * (1 - DATA_HEAT_FLOOR);
}

function HeatTooltip({
  day,
  hour,
  value,
}: {
  day: number;
  hour: number;
  value: number;
}) {
  const ratio = value * HOURS_PER_WEEK;
  return (
    <div
      className={cn(
        DATA_TOOLTIP_CLASS,
        hour > LAST_HOUR - 4 ? "right-0" : "left-1/2 -translate-x-1/2",
        hour < 4 && "left-0 translate-x-0"
      )}
    >
      <span className="text-muted-foreground">
        {DATA_WEEKDAYS[day]} · {hourLabel(hour)}–{hourLabel((hour + 1) % 24)}{" "}
        UTC
      </span>
      <span className="text-foreground font-medium tabular-nums">
        {formatShare(value)} of a typical site's week
      </span>
      <span className="text-muted-foreground tabular-nums">
        {ratio.toLocaleString("en", { maximumFractionDigits: 1 })}× an average
        hour
      </span>
    </div>
  );
}

/** When in the week one kind of AI traffic arrives, as a weekday × UTC hour grid. */
export function DataHeatmap({
  grid,
  kind,
}: {
  grid: DataHourGrid;
  kind: DataTrafficKind;
}) {
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(
    null
  );
  const values = grid.flat();
  const max = Math.max(...values);
  const min = Math.min(...values);
  const busiest = busiestCell(grid);
  const busiestLabel = `${DATA_WEEKDAYS[busiest.day]} ${hourLabel(busiest.hour)} UTC`;

  return (
    <ReportPanel
      bodyClassName="flex flex-col gap-3 p-4"
      header={
        <span className="text-xs font-normal">
          Busiest:{" "}
          <span className="text-foreground font-medium">{busiestLabel}</span>
        </span>
      }
    >
      <div
        aria-label={`${kind === "crawlers" ? "Crawler" : "Referral"} visits by weekday and hour. Busiest: ${busiestLabel}.`}
        className={cn("grid gap-1", HEAT[kind])}
        // A lifted finger also "leaves", so on touch the last tapped cell keeps its card.
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") {
            setHovered(null);
          }
        }}
        role="img"
        style={{ gridTemplateColumns: "2rem repeat(24, minmax(0, 1fr))" }}
      >
        {grid.map((row, day) => (
          <div className="contents" key={DATA_WEEKDAYS[day]}>
            <span className="text-muted-foreground self-center text-[11px]">
              {DATA_WEEKDAYS[day]}
            </span>
            {HOURS.map((hour) => {
              const value = row[hour] ?? 0;
              const strength = heatStrength(value, min, max);
              const active = hovered?.day === day && hovered.hour === hour;
              return (
                <div
                  className={cn(
                    "relative aspect-square rounded-[3px] transition-shadow sm:rounded-[4px]",
                    active && "ring-foreground/70 z-10 ring-2"
                  )}
                  key={hour}
                  onPointerDown={() => setHovered({ day, hour })}
                  onPointerEnter={() => setHovered({ day, hour })}
                  style={{
                    backgroundColor: `color-mix(in oklab, var(--heat) ${Math.round(strength * 100)}%, var(--table-card, transparent))`,
                  }}
                >
                  {active ? (
                    <HeatTooltip day={day} hour={hour} value={value} />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        <span />
        {HOURS.map((hour) => (
          <span
            className="text-muted-foreground text-[11px] whitespace-nowrap tabular-nums"
            key={hour}
          >
            {HOUR_TICKS.has(hour) ? hourLabel(hour) : null}
          </span>
        ))}
      </div>
    </ReportPanel>
  );
}
