"use client";

import { Checkbox } from "@notra/ui/components/ui/checkbox";

import { CompetitorBrandLogo } from "@/components/onboarding/competitor-brand-logo";
import { cn } from "@/lib/utils";
import type { CompetitorChoiceRowProps } from "@/types/onboarding";

export function CompetitorChoiceRow({
  name,
  domain,
  description,
  selected,
  disabled,
  onToggle,
}: CompetitorChoiceRowProps) {
  return (
    <li className="border-table-row-border min-w-0 border-b last:border-b-0">
      <label
        className={cn(
          "hover:bg-muted/60 flex min-w-0 cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Checkbox
          checked={selected}
          disabled={disabled}
          onCheckedChange={onToggle}
        />
        <CompetitorBrandLogo
          className="size-8 rounded-md"
          domain={domain}
          logo={null}
          name={name}
        />
        <span
          className={cn(
            "min-w-0 flex-1 transition-colors",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
            <span className="min-w-0 truncate text-sm font-medium">{name}</span>
            {domain ? (
              <span className="text-muted-foreground truncate text-xs">
                {domain}
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="text-muted-foreground block text-xs text-pretty">
              {description}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
