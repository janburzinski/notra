"use client";

import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScheduleOutputType } from "@notra/schemas/dashboard/integrations";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { OUTPUT_TYPE_LABEL_KEYS } from "@/constants/automation-output-types";
import { FORMAT_CARD_META, FORMAT_ORDER } from "@/constants/content-formats";
import { OutputTypeIcon } from "@/utils/output-types";

interface FormatPickerProps {
  value: ScheduleOutputType;
  onChange: (value: ScheduleOutputType) => void;
}

/** One selectable row per content format; render directly inside an `EditorBox`. */
export function FormatPicker({ value, onChange }: FormatPickerProps) {
  const t = useTranslations("content.create.formats");
  const tLabels = useTranslations("common.labels");

  return (
    <>
      {FORMAT_ORDER.map((type) => {
        const selected = value === type;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "group duration-fast focus-visible:bg-muted/50 flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none",
              selected ? "bg-muted/40" : "hover:bg-muted/30"
            )}
            key={type}
            onClick={() => onChange(type)}
            type="button"
          >
            <span className="bg-background ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
              <OutputTypeIcon
                className={cn("size-4", FORMAT_CARD_META[type].iconClass)}
                outputType={type}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {tLabels(OUTPUT_TYPE_LABEL_KEYS[type])}
              </span>
              <span className="text-muted-foreground block text-sm">
                {t(`${type}.description`)}
              </span>
            </span>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                selected
                  ? "bg-foreground text-background"
                  : "border-muted-foreground/30 group-hover:border-muted-foreground/50 border"
              )}
            >
              {selected && (
                <HugeiconsIcon
                  className="size-3"
                  icon={Tick01Icon}
                  strokeWidth={3}
                />
              )}
            </span>
          </button>
        );
      })}
    </>
  );
}
