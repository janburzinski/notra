"use client";

import { Checkbox } from "@notra/ui/components/ui/checkbox";

import { cn } from "@/lib/utils";
import type { PromptChoiceRowProps } from "@/types/onboarding";

export function PromptChoiceRow({
  prompt,
  selected,
  disabled,
  onToggle,
}: PromptChoiceRowProps) {
  return (
    <li className="border-table-row-border min-w-0 border-b last:border-b-0">
      <label
        className={cn(
          "hover:bg-muted/60 flex min-w-0 cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Checkbox
          checked={selected}
          className="mt-0.5"
          disabled={disabled}
          onCheckedChange={onToggle}
        />
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-5 text-pretty transition-colors",
            !selected && "text-muted-foreground"
          )}
        >
          {prompt}
        </span>
      </label>
    </li>
  );
}
