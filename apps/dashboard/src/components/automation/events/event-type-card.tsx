"use client";

import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { EVENT_TYPE_META } from "@/constants/event-triggers";
import type { EventTypeCardProps } from "@/types/automation/event-trigger";

/** One selectable row inside the trigger-event box. */
export function EventTypeCard({
  eventType,
  selected,
  onSelect,
}: EventTypeCardProps) {
  const t = useTranslations("automation.events.eventTypes");
  const tLabels = useTranslations("common.labels");
  const meta = EVENT_TYPE_META[eventType];

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "group duration-fast focus-visible:bg-muted/50 flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none",
        selected ? "bg-muted/40" : "hover:bg-muted/30"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="bg-background ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
        <HugeiconsIcon
          className={cn("size-4", meta.iconClass)}
          icon={meta.icon}
          strokeWidth={1.75}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {eventType === "release"
            ? tLabels("releasePublished")
            : t(`${eventType}.label`)}
        </span>
        <span className="text-muted-foreground block text-sm">
          {t(`${eventType}.description`)}
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
          <HugeiconsIcon className="size-3" icon={Tick01Icon} strokeWidth={3} />
        )}
      </span>
    </button>
  );
}
