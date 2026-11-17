"use client";

import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { InstrumentModule } from "ui/card";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyStateTrendPreview } from "@/components/empty-state-preview";
import {
  GEO_SENTIMENT_EMPTY_LABEL_KEYS,
  SENTIMENT_PREVIEW_ROWS,
} from "@/constants/geo-sentiment";
import { cn } from "@/lib/utils";
import type { SentimentBreakdownPlaceholderProps } from "@/types/geo-sentiment";

const FADE_MASK =
  "[mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]";

export function SentimentBreakdownPlaceholder({
  state,
  emptyKey,
  isScanning,
  retry,
}: SentimentBreakdownPlaceholderProps) {
  const t = useTranslations("geo.sentimentBreakdown");
  const tGeoShared = useTranslations("geo.shared");
  const tSkeleton = useTranslations("geo.sentimentSkeleton");
  const tScore = useTranslations("geo.brandSentimentCard");
  const busy = state === "pending" || (state === "empty" && isScanning);

  let title = t("empty.title");
  let body = tGeoShared(GEO_SENTIMENT_EMPTY_LABEL_KEYS[emptyKey]);
  if (state === "error") {
    title = t("error.title");
    body = t("error.body");
  } else if (state === "pending") {
    title = t("loading.title");
    body = "";
  } else if (busy) {
    title = t("empty.scanningTitle");
    body = tGeoShared("scanInProgress");
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 @min-[44rem]/main:grid-cols-12">
      <InstrumentModule
        className="h-full @min-[44rem]/main:col-span-5"
        eyebrow={t("eyebrow")}
        hint={tScore("scoreHint")}
        variant="table"
      >
        <div
          aria-hidden="true"
          className={cn("flex flex-1 flex-col gap-4 select-none", FADE_MASK)}
        >
          <Skeleton className="h-7 w-24 animate-none" />
          <Skeleton className="h-1.5 w-full animate-none rounded-full" />
          <div className="flex flex-col">
            {SENTIMENT_PREVIEW_ROWS.map((width) => (
              <div
                className="flex h-11 items-center justify-between gap-4 border-b last:border-b-0"
                key={width}
              >
                <Skeleton
                  className="h-4 animate-none"
                  style={{ width: `${width}%` }}
                />
                <Skeleton className="h-4 w-6 animate-none" />
              </div>
            ))}
          </div>
        </div>
      </InstrumentModule>
      <InstrumentModule
        bodyClassName="relative flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4"
        className="h-full @min-[44rem]/main:col-span-7"
        eyebrow={t("trendEyebrow")}
        variant="table"
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none min-h-64 flex-1 select-none",
            busy ? "opacity-70" : "opacity-40"
          )}
        >
          <EmptyStateTrendPreview />
        </div>
        <div
          aria-busy={busy}
          aria-label={state === "pending" ? tSkeleton("loading") : undefined}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
          role={state === "error" ? "alert" : "status"}
        >
          <h3 className="text-base font-medium text-balance">
            {busy ? <Shimmer as="span">{title}</Shimmer> : title}
          </h3>
          {body ? (
            <p className="text-muted-foreground max-w-xs text-sm text-balance">
              {body}
            </p>
          ) : null}
          {state === "error" ? (
            <Button onClick={retry} size="sm" variant="outline">
              {t("error.retry")}
            </Button>
          ) : null}
        </div>
      </InstrumentModule>
    </div>
  );
}
