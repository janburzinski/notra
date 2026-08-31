"use client";

import { cn } from "@notra/ui/lib/utils";

import type { PlanTextProps } from "@/types/content/plan";

export function PlanText({
  "aria-label": ariaLabel,
  className,
  maxLength,
  onChange,
  onCommit,
  placeholder,
  readOnly = false,
  value,
}: PlanTextProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      className={cn(
        "caret-foreground field-sizing-content w-full resize-none bg-transparent",
        "-mx-1 rounded-sm px-1 py-0.5",
        "placeholder:text-muted-foreground/70",
        "hover:bg-muted/40 focus:bg-muted/40",
        "ring-0 outline-none focus-visible:ring-0",
        "disabled:hover:bg-transparent disabled:focus:bg-transparent",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      disabled={readOnly}
      maxLength={maxLength}
      onBlur={onCommit}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.shiftKey) {
          return;
        }
        event.preventDefault();
        event.currentTarget.blur();
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      value={value}
    />
  );
}
