"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "use-intl";

import type { TrafficTrendLegendProps } from "@/types/geo";
import { formatWebShare } from "@/utils/web-analytics";

/**
 * Key under a traffic trend chart. With `onToggle` each entry shows or hides
 * its series; without it the key only names the colors.
 */
export function TrafficTrendLegend({
  items,
  hiddenKeys = [],
  onToggle,
}: TrafficTrendLegendProps) {
  const t = useTranslations("geo.webVisitors");
  const hidden = new Set(hiddenKeys);
  return (
    <ul className="border-border mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-3 text-xs">
      {items.map((entry) => {
        const label = (
          <>
            <span
              aria-hidden="true"
              className="corner-squircle size-2 rounded-xs bg-(--dot-light) dark:bg-(--dot-dark)"
              style={
                {
                  "--dot-light": entry.color.light,
                  "--dot-dark": entry.color.dark,
                } as CSSProperties
              }
            />
            <span>{entry.label}</span>
            {entry.share === undefined ? null : (
              <span className="text-muted-foreground tabular-nums">
                {t("share", { share: formatWebShare(entry.share) })}
              </span>
            )}
          </>
        );
        return (
          <li key={entry.key}>
            {onToggle ? (
              <button
                aria-pressed={!hidden.has(entry.key)}
                className="hover:bg-muted focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2 py-1 transition-opacity outline-none focus-visible:ring-2 aria-[pressed=false]:line-through aria-[pressed=false]:opacity-40"
                onClick={() => onToggle(entry.key)}
                type="button"
              >
                {label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-1">
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
