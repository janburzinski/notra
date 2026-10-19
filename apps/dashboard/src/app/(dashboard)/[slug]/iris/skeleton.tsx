"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useId } from "react";
import { useTranslations } from "use-intl";

/** Mirrors IrisRunningState with every readiness item done. */
export function IrisPageSkeleton() {
  const id = useId();
  const t = useTranslations("iris.running");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Iris</h1>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-[5.25rem] rounded-md" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            className="h-[5.25rem] w-full rounded-xl"
            key={`${id}-tile-${index + 1}`}
          />
        ))}
      </div>

      <Tabs value="activity">
        <TabsList variant="line">
          <TabsTrigger disabled value="activity">
            {tCommon("labels.activity")}
          </TabsTrigger>
          <TabsTrigger disabled value="signals">
            {t("tabs.signals")}
          </TabsTrigger>
        </TabsList>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              className="h-36 w-full rounded-xl"
              key={`${id}-run-${index + 1}`}
            />
          ))}
        </div>
      </Tabs>
    </div>
  );
}
