import {
  GEO_MENTION_FADE_HEIGHT_REM,
  GEO_MENTION_ROW_HEIGHT_REM,
  GEO_MENTION_SUMMARY_VISIBLE,
} from "@notra/geo-core/constants/geo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useFormatter, useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import {
  SENTIMENT_POLARITIES,
  SENTIMENT_POLARITY_STYLES,
} from "@/constants/geo-sentiment";
import { useScrollOverflow } from "@/lib/hooks/use-scroll-overflow";
import { cn } from "@/lib/utils";
import type { SentimentFamilyBucket } from "@/types/geo-sentiment";

const ROW_STYLE = { height: `${GEO_MENTION_ROW_HEIGHT_REM}rem` } as const;
const LIST_STYLE = {
  maxHeight: `${GEO_MENTION_SUMMARY_VISIBLE * GEO_MENTION_ROW_HEIGHT_REM + GEO_MENTION_FADE_HEIGHT_REM}rem`,
  scrollbarWidth: "none",
} as const;

export function SentimentEngineList({
  families,
}: {
  families: readonly SentimentFamilyBucket[];
}) {
  const t = useTranslations("geo.sentimentBreakdown");
  const tCommon = useTranslations("common.labels");
  const tGeoShared = useTranslations("geo.shared");
  const format = useFormatter();
  const { ref, atEnd } = useScrollOverflow<HTMLDivElement>(families.length);

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-sm font-medium">
        <span>{tGeoShared("provider")}</span>
        <span>{t("scoreColumn")}</span>
      </div>
      <div className="relative">
        <div
          aria-label={t("scoreByProvider")}
          className="focus-visible:ring-ring relative overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 [&::-webkit-scrollbar]:hidden [&>button:last-of-type]:border-b-0"
          ref={ref}
          role="region"
          style={LIST_STYLE}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll region must support keyboard scrolling.
          tabIndex={0}
        >
          {families.map(({ family, iconEngine, label, bucket }, index) => (
            <Tooltip key={family}>
              <TooltipTrigger
                className="hover:bg-muted/50 focus-visible:bg-muted/50 grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 border-b text-left transition-colors outline-none"
                style={ROW_STYLE}
              >
                <span className="text-muted-foreground w-4 text-right text-xs tabular-nums">
                  {index + 1}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center">
                    <EngineIcon className="size-4" engine={iconEngine} />
                  </span>
                  <span className="truncate text-sm font-medium">{label}</span>
                </span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    bucket.score === null && "text-muted-foreground"
                  )}
                >
                  {bucket.score === null
                    ? "—"
                    : format.number(Math.round(bucket.score))}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                <div className="flex min-w-40 flex-col gap-1.5 text-xs">
                  <span className="font-medium">{label}</span>
                  {bucket.classifiedMentions === 0 ? (
                    <span className="opacity-70">{t("noRatedAnswers")}</span>
                  ) : (
                    <>
                      {SENTIMENT_POLARITIES.map((polarity) => (
                        <span
                          className="flex items-center gap-1.5"
                          key={polarity}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-2 rounded-full",
                              polarity === "neutral"
                                ? "bg-background/50"
                                : SENTIMENT_POLARITY_STYLES[polarity].fill
                            )}
                          />
                          <span className="opacity-70">
                            {tCommon(polarity)}
                          </span>
                          <span className="ml-auto font-medium tabular-nums">
                            {format.number(bucket[`${polarity}Share`] ?? 0, {
                              style: "percent",
                              maximumFractionDigits: 1,
                            })}
                          </span>
                        </span>
                      ))}
                      <span className="opacity-70">
                        {t("ratedAnswers", {
                          count: bucket.classifiedMentions,
                        })}
                      </span>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "from-table-card pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent transition-opacity duration-200 motion-reduce:transition-none",
            atEnd ? "opacity-0" : "opacity-100"
          )}
          style={{ height: `${GEO_MENTION_FADE_HEIGHT_REM}rem` }}
        />
      </div>
    </div>
  );
}
