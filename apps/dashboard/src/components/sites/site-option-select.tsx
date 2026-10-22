"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import type { SiteOptionSelectProps } from "@/types/site-design";

export function SiteOptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  preview,
  describe,
}: SiteOptionSelectProps<T>) {
  const descriptionId = useId();
  const [highlighted, setHighlighted] = useState<T>(value);
  const active = options.find((option) => option.value === highlighted);
  return (
    <Select
      onOpenChange={(open) => {
        if (open) {
          setHighlighted(value);
        }
      }}
      onValueChange={(next: T | null) => {
        if (next) {
          onChange(next);
        }
      }}
      value={value}
    >
      <SelectTrigger aria-label={label} className={cn("w-full", className)}>
        <SelectValue>
          {(current: T) =>
            options.find((option) => option.value === current)?.label
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        aside={
          preview && active ? (
            <div className="bg-popover hidden w-60 shrink-0 overflow-hidden rounded-xl border shadow-lg sm:block">
              <div aria-hidden="true">{preview(active.value)}</div>
              <div aria-hidden="true" className="space-y-0.5 px-3 py-2.5">
                <p className="text-sm font-medium">{active.label}</p>
                {describe ? (
                  <p className="text-muted-foreground text-xs text-pretty">
                    {describe(active.value)}
                  </p>
                ) : null}
              </div>
              {describe
                ? options.map((option) => (
                    <span
                      className="sr-only"
                      id={`${descriptionId}-${option.value}`}
                      key={option.value}
                    >
                      {describe(option.value)}
                    </span>
                  ))
                : null}
            </div>
          ) : null
        }
        className="max-h-80"
      >
        {options.map((option) => (
          <SelectItem
            aria-describedby={
              preview && describe
                ? `${descriptionId}-${option.value}`
                : undefined
            }
            key={option.value}
            onFocus={() => setHighlighted(option.value)}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
