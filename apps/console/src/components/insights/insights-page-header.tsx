"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";

import type { InsightsPageHeaderProps } from "@/types/insights";

/** Title, description and the time range picker of an insights page. */
export function InsightsPageHeader({
  title,
  description,
  options,
  days,
  onDaysChange,
}: InsightsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Tabs onValueChange={(value: number) => onDaysChange(value)} value={days}>
        <TabsList
          aria-label="Time range"
          className="group-data-[orientation=horizontal]/tabs:h-8"
        >
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
