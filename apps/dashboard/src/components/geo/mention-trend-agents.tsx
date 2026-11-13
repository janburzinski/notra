"use client";

import { ArrowUpDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_FILTER_TRIGGER_CLASS,
  GEO_MENTION_TREND_AGENT_ICON_LIMIT,
} from "@notra/geo-core/constants/geo";
import { engineFamilyOf } from "@notra/geo-core/utils/geo-engine-family";
import { resolveEngineIconKey } from "@notra/geo-core/utils/geo-engine-icon";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import {
  SIMPLE_ENGINE_ICONS,
  THEMED_ENGINE_ICONS,
} from "@/constants/geo-engine-icons";
import { cn } from "@/lib/utils";
import type { MentionTrendAgentsPickerProps } from "@/types/geo";

export function MentionTrendAgentsPicker({
  series,
  activeKeys,
  onToggle,
  disabled = false,
}: MentionTrendAgentsPickerProps) {
  const t = useTranslations("geo.mentionTrendAgents");
  const tGeoShared = useTranslations("geo.shared");
  const seenLogos = new Set<unknown>();
  const preview = series
    .filter((entry) => {
      const logo = drawnLogoOf(entry.engine);
      if (seenLogos.has(logo)) {
        return false;
      }
      seenLogos.add(logo);
      return true;
    })
    .slice(0, GEO_MENTION_TREND_AGENT_ICON_LIMIT);
  const active = series.filter((entry) => activeKeys.has(entry.key));
  const accessibleLabel = t("accessibleLabel", {
    count: active.length,
    names: active.map((entry) => entry.label).join(", "),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={accessibleLabel}
        className={cn(
          GEO_FILTER_TRIGGER_CLASS,
          disabled && "pointer-events-none opacity-50"
        )}
        disabled={disabled}
      >
        {preview.length > 0 ? (
          // Each logo is cut out where the next one overlaps it (16px step,
          // 1px gap), so the rims never cross.
          <span className="-ms-1.5 flex shrink-0 items-center">
            {preview.map((entry) => (
              <span
                className="bg-background border-foreground/15 relative -ms-1 grid size-5 shrink-0 place-items-center rounded-full border first:ms-0 [&:not(:last-child)]:[mask-image:radial-gradient(circle_at_26px_50%,transparent_11px,black_11.5px)]"
                key={entry.key}
              >
                <EngineIcon className="size-2.5" engine={entry.engine} />
              </span>
            ))}
          </span>
        ) : null}
        <span>{tGeoShared("allModels")}</span>
        <HugeiconsIcon
          className="text-muted-foreground"
          icon={ArrowUpDownIcon}
          size={12}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("showByProvider")}</DropdownMenuLabel>
          {series.map((entry) => (
            <DropdownMenuCheckboxItem
              checked={activeKeys.has(entry.key)}
              key={entry.key}
              onCheckedChange={() => onToggle(entry.key)}
            >
              <EngineIcon className="size-3.5" engine={entry.engine} />
              {entry.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Claude and Claude Code share one logo; dedupe on what is drawn. */
function drawnLogoOf(engine: string): unknown {
  const key = resolveEngineIconKey(engine);
  if (!key) {
    return engineFamilyOf(engine);
  }
  return SIMPLE_ENGINE_ICONS[key] ?? THEMED_ENGINE_ICONS[key]?.[0] ?? key;
}
