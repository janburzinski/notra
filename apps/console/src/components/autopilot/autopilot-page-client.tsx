"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AutopilotHealthClient } from "@/components/autopilot/autopilot-health-client";
import { AutopilotRunsClient } from "@/components/autopilot/autopilot-runs-client";
import {
  AUTOPILOT_HEALTH_DEFAULT_DAYS,
  AUTOPILOT_HEALTH_RANGE_OPTIONS,
} from "@/constants/autopilot";
import type {
  AutopilotPageClientProps,
  AutopilotView,
} from "@/types/autopilot";

export function AutopilotPageClient({ slug, view }: AutopilotPageClientProps) {
  const router = useRouter();
  const [days, setDays] = useState<number>(AUTOPILOT_HEALTH_DEFAULT_DAYS);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Autopilot</h1>
          <p className="text-muted-foreground text-sm">
            How Autopilot is doing across every workspace. Notra admins only.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            onValueChange={(value: AutopilotView) => {
              const { pathname } = window.location;
              router.replace(
                value === "runs" ? `${pathname}?view=runs` : pathname,
                { scroll: false }
              );
            }}
            value={view}
          >
            <TabsList aria-label="View">
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "health" ? (
            <Tabs
              onValueChange={(value: number) => setDays(value)}
              value={days}
            >
              <TabsList aria-label="Time range">
                {AUTOPILOT_HEALTH_RANGE_OPTIONS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
      </header>
      {view === "health" ? (
        <AutopilotHealthClient days={days} slug={slug} />
      ) : (
        <AutopilotRunsClient slug={slug} />
      )}
    </main>
  );
}
