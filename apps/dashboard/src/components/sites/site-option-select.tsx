"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";

import { cn } from "@/lib/utils";
import type { SiteOptionSelectProps } from "@/types/site-design";

export function SiteOptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SiteOptionSelectProps<T>) {
  return (
    <Select
      onValueChange={(next: T | null) => {
        if (next) {
          onChange(next);
        }
      }}
      value={value}
    >
      <SelectTrigger aria-label={label} className={cn("w-44", className)}>
        <SelectValue>
          {(current: T) =>
            options.find((option) => option.value === current)?.label
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-h-80"
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
