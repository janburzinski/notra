"use client";

import { ChartEnvironmentProvider } from "@notra/ui/components/evilcharts/ui/chart-environment";
import type { ChartEnvironment } from "@notra/ui/types/charts";
import { type ReactNode, useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";

import { ChartDownloadButton } from "@/components/charts/chart-download-button";
import { cn } from "@/lib/utils";

const EXPORT_REVEAL =
  "pointer-events-none opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover/chart:opacity-100 group-focus-within/chart:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 group-hover/chart:pointer-events-auto group-focus-within/chart:pointer-events-auto motion-reduce:transition-none";

function ChartPlotChrome() {
  return (
    <div
      className={cn(
        "absolute top-1 right-1 z-[1] hidden @min-[12rem]:block",
        EXPORT_REVEAL
      )}
    >
      <ChartDownloadButton className="bg-background/80 hover:bg-background" />
    </div>
  );
}

/** Dashboard charts format in the user's locale and offer a PNG download. */
export function DashboardChartEnvironment({
  children,
}: {
  children: ReactNode;
}) {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const loadingLabel = tCommon("states.loading");
  const value = useMemo<ChartEnvironment>(
    () => ({ locale, loadingLabel, PlotChrome: ChartPlotChrome }),
    [locale, loadingLabel]
  );
  return (
    <ChartEnvironmentProvider value={value}>
      {children}
    </ChartEnvironmentProvider>
  );
}
