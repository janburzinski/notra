"use client";

import { WEB_VITAL_METRICS } from "@notra/geo-core/constants/web-analytics";
import {
  PermissionOption,
  PermissionRow,
} from "@notra/ui/components/ui/permission-selector";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  TABLE_BODY_CLASS,
  TABLE_FRAME_CLASS,
  TABLE_ROW_BORDER_CLASS,
} from "@notra/ui/constants/table";
import { type CSSProperties, type ReactNode, useState } from "react";
import { InstrumentSection } from "ui/card";
import { useLocale, useTranslations } from "use-intl";

import { WebScriptEmpty } from "@/components/geo/web-script-empty";
import {
  WEB_VITAL_RATING_FILL_CLASS,
  WEB_VITAL_RATING_TEXT_CLASS,
  WEB_VITAL_RATINGS,
  WEB_VITALS_DEVICE_FILTERS,
} from "@/constants/web-analytics";
import { cn } from "@/lib/utils";
import type {
  WebVitalDistributionProps,
  WebVitalRating,
  WebVitalRowProps,
  WebVitalsCardProps,
  WebVitalsDeviceFilter,
} from "@/types/geo";
import {
  formatWebVital,
  formatWebVitalRangeStart,
  webVitalCounts,
  webVitalParts,
  webVitalRating,
  webVitalShareLabel,
  webVitalThresholds,
} from "@/utils/web-analytics";

const ROW_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-4 py-3.5 @2xl/instrument:grid-cols-[minmax(0,13rem)_9rem_minmax(0,1fr)]";

function useRatingLabels(): Record<WebVitalRating, string> {
  const t = useTranslations("geo.webVisitors");
  return {
    good: t("vitalGood"),
    "needs-improvement": t("vitalNeedsWork"),
    poor: t("vitalPoor"),
  };
}

/** Share of views per rating as a stacked bar, with each band's threshold. */
function WebVitalDistribution({ vital }: WebVitalDistributionProps) {
  const t = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const labels = useRatingLabels();
  const counts = webVitalCounts(vital);
  const [good, poor] = webVitalThresholds(vital.metric);
  const ranges: Record<WebVitalRating, string> = {
    good: t("vitalRange.good", {
      value: formatWebVital(vital.metric, good, locale),
    }),
    "needs-improvement": t("vitalRange.needsImprovement", {
      from: formatWebVitalRangeStart(vital.metric, good, poor, locale),
      to: formatWebVital(vital.metric, poor, locale),
    }),
    poor: t("vitalRange.poor", {
      value: formatWebVital(vital.metric, poor, locale),
    }),
  };
  return (
    <div className="col-span-2 min-w-0 @2xl/instrument:col-span-1">
      <div aria-hidden="true" className="flex h-2 w-full gap-0.5">
        {WEB_VITAL_RATINGS.map((rating) =>
          counts[rating] > 0 ? (
            <span
              className={cn(
                "h-full min-w-1 grow-(--vital-views) basis-0 first:rounded-s-full last:rounded-e-full",
                WEB_VITAL_RATING_FILL_CLASS[rating]
              )}
              key={rating}
              style={{ "--vital-views": counts[rating] } as CSSProperties}
            />
          ) : null
        )}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">
        {WEB_VITAL_RATINGS.map((rating) => (
          <div className="min-w-0" key={rating}>
            <dt className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  WEB_VITAL_RATING_FILL_CLASS[rating]
                )}
              />
              <span className="sr-only">{labels[rating]}</span>
              <span className="truncate tabular-nums">{ranges[rating]}</span>
            </dt>
            <dd className="text-foreground mt-0.5 font-medium tabular-nums">
              {webVitalShareLabel(counts[rating], vital.samples, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function WebVitalRow({ vital }: WebVitalRowProps) {
  const t = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const labels = useRatingLabels();
  const rating = webVitalRating(vital.metric, vital.p75);
  const { number, unit } = webVitalParts(vital.metric, vital.p75, locale);
  return (
    <li
      className={cn(ROW_GRID_CLASS, "last:border-b-0", TABLE_ROW_BORDER_CLASS)}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {t(`vitalName.${vital.metric}`)}
        </p>
        <p className="text-muted-foreground truncate text-xs tabular-nums">
          <span className="font-medium uppercase">{vital.metric}</span>
          {" · "}
          {t("vitalSummary", { count: vital.samples })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 @2xl/instrument:items-start">
        <p className="text-xl leading-7 font-semibold tracking-tight tabular-nums">
          {number}
          {unit ? (
            <span className="text-muted-foreground ms-0.5 text-sm font-medium">
              {unit}
            </span>
          ) : null}
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
            WEB_VITAL_RATING_TEXT_CLASS[rating]
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              WEB_VITAL_RATING_FILL_CLASS[rating]
            )}
          />
          {labels[rating]}
        </p>
      </div>
      <WebVitalDistribution vital={vital} />
    </li>
  );
}

function WebVitalRowSkeleton() {
  return (
    <li
      className={cn(ROW_GRID_CLASS, "last:border-b-0", TABLE_ROW_BORDER_CLASS)}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <div className="flex flex-col items-end gap-1.5 @2xl/instrument:items-start">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="col-span-2 flex min-w-0 flex-col gap-2 @2xl/instrument:col-span-1">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-8.5 w-full" />
      </div>
    </li>
  );
}

/**
 * Core Web Vitals from real visits: one row per metric with its p75, rating
 * and how page views split across Google's thresholds, for all devices or
 * mobile and desktop on their own.
 */
export function WebVitalsCard({ reports, loading }: WebVitalsCardProps) {
  const t = useTranslations("geo.webVisitors");
  const [device, setDevice] = useState<WebVitalsDeviceFilter>("all");
  const byDevice = reports?.vitalsByDevice;
  const hasDeviceSplit = Boolean(
    byDevice && byDevice.mobile.length > 0 && byDevice.desktop.length > 0
  );
  const source =
    device === "all" || !hasDeviceSplit ? reports?.vitals : byDevice?.[device];
  const vitals = WEB_VITAL_METRICS.flatMap((metric) =>
    (source ?? []).filter(
      (vital) => vital.metric === metric && vital.samples > 0
    )
  );
  const deviceLabels: Record<WebVitalsDeviceFilter, string> = {
    all: t("vitalsDeviceAll"),
    mobile: t("deviceMobile"),
    desktop: t("deviceDesktop"),
  };

  let action: ReactNode;
  if (loading) {
    action = <Skeleton className="h-7 w-60 rounded-lg" />;
  } else if (hasDeviceSplit) {
    action = (
      <PermissionRow
        className="w-fit shrink-0"
        label={t("vitalsDeviceLabel")}
        layout="compact"
        onValueChange={(value) => {
          const next = WEB_VITALS_DEVICE_FILTERS.find(
            (filter) => filter === value
          );
          if (next) {
            setDevice(next);
          }
        }}
        value={device}
      >
        {WEB_VITALS_DEVICE_FILTERS.map((filter) => (
          <PermissionOption key={filter} value={filter}>
            {deviceLabels[filter]}
          </PermissionOption>
        ))}
      </PermissionRow>
    );
  }

  let body: ReactNode;
  if (loading) {
    body = (
      <ul aria-hidden="true">
        {WEB_VITAL_METRICS.map((metric) => (
          <WebVitalRowSkeleton key={metric} />
        ))}
      </ul>
    );
  } else if (vitals.length === 0) {
    body = (
      <WebScriptEmpty
        description={t("vitalsEmptyDescription")}
        title={t("vitalsEmptyTitle")}
      />
    );
  } else {
    body = (
      <ul>
        {vitals.map((vital) => (
          <WebVitalRow key={vital.metric} vital={vital} />
        ))}
      </ul>
    );
  }

  return (
    <InstrumentSection
      action={action}
      description={t("vitalsDescription")}
      eyebrow={t("webVitals")}
    >
      <div className={TABLE_FRAME_CLASS}>
        <div className={TABLE_BODY_CLASS}>{body}</div>
      </div>
    </InstrumentSection>
  );
}
