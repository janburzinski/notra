"use client";

import { InstrumentModule } from "ui/card";
import { useFormatter, useTranslations } from "use-intl";

import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { SentimentEngineList } from "@/components/geo/sentiment-engine-list";
import { SentimentTrendChart } from "@/components/geo/sentiment-trend-chart";
import type { SentimentBreakdownProps } from "@/types/geo-sentiment";
import { sentimentFamilyBuckets } from "@/utils/geo-sentiment";

export function SentimentBreakdown({
  data,
  isScanning,
}: SentimentBreakdownProps) {
  const t = useTranslations("geo.sentimentBreakdown");
  const tCommon = useTranslations("common.labels");
  const tGeoShared = useTranslations("geo.shared");
  const tScore = useTranslations("geo.brandSentimentCard");
  const format = useFormatter();
  const { summary, comparison, points, engines } = data;
  const families = sentimentFamilyBuckets(engines);
  const formatShare = (share: number | null) =>
    share === null
      ? "—"
      : format.number(share, { style: "percent", maximumFractionDigits: 0 });
  const scanning = isScanning ? tGeoShared("scanInProgress") : undefined;

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 @min-[44rem]/main:grid-cols-12">
      <InstrumentModule
        className="h-full @min-[44rem]/main:col-span-5"
        eyebrow={t("eyebrow")}
        hint={tScore("scoreHint")}
        readout={scanning}
        variant="table"
      >
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-end gap-2">
            <p className="flex items-baseline gap-1.5 text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {summary.score === null
                ? "—"
                : format.number(Math.round(summary.score))}
              <span className="text-muted-foreground text-sm font-normal">
                / 100
              </span>
            </p>
            <span className="mb-0.5 inline-flex">
              <GeoStatDelta
                delta={comparison?.delta ?? null}
                hint={t("deltaHint")}
                kind="score"
                label={t("deltaLabel")}
              />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div
              aria-label={
                summary.score === null
                  ? t("noRatedAnswers")
                  : t("scaleLabel", { score: Math.round(summary.score) })
              }
              className="relative flex h-3.5 items-center"
              role="img"
            >
              <div className="from-geo-down/45 via-muted to-geo-up/45 h-1 w-full rounded-full bg-linear-to-r" />
              {summary.score === null ? null : (
                <span
                  aria-hidden="true"
                  className="bg-foreground absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full"
                  style={{
                    left: `${Math.min(100, Math.max(0, summary.score))}%`,
                  }}
                />
              )}
            </div>
            <div className="text-muted-foreground/70 text-2xs flex justify-between">
              <span>{tCommon("negative")}</span>
              <span>{tCommon("positive")}</span>
            </div>
            <p className="text-muted-foreground text-xs tabular-nums">
              {t("mixSummary", {
                positive: formatShare(summary.positiveShare),
                neutral: formatShare(summary.neutralShare),
                negative: formatShare(summary.negativeShare),
              })}
            </p>
          </div>
          <SentimentEngineList families={families} />
        </div>
      </InstrumentModule>
      <InstrumentModule
        bodyClassName="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4"
        className="h-full @min-[44rem]/main:col-span-7"
        eyebrow={t("trendEyebrow")}
        variant="table"
      >
        <SentimentTrendChart points={points} />
      </InstrumentModule>
    </div>
  );
}
