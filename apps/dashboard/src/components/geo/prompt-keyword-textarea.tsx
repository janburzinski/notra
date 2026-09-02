"use client";

import {
  HoverCard,
  HoverCardTrigger,
} from "@notra/ui/components/ui/hover-card";
import { Google } from "@notra/ui/components/ui/svgs/google";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { forwardRef, useMemo } from "react";

import { TrafficBreakdownCard } from "@/components/geo/traffic-breakdown-card";
import { GEO_TRAFFIC_HOVER_DELAY_MS } from "@/constants/geo-traffic-hover";
import { cn } from "@/lib/utils";
import type { PromptKeywordTextareaProps } from "@/types/geo";
import { findPromptKeywordSegments } from "@/utils/geo-prompt-keywords";

export const PromptKeywordTextarea = forwardRef<
  HTMLTextAreaElement,
  PromptKeywordTextareaProps
>(function PromptKeywordTextarea(
  { className, keywords, value, ...props },
  ref
) {
  const segments = useMemo(
    () => findPromptKeywordSegments(value, keywords),
    [keywords, value]
  );
  const hasMatches = segments.some((segment) => segment.keyword !== null);

  return (
    <div className="relative grid">
      <Textarea
        className={cn(
          "relative z-10 col-start-1 row-start-1 leading-5 transition-[border-color,box-shadow]",
          hasMatches &&
            "caret-foreground text-transparent selection:text-transparent",
          className
        )}
        ref={ref}
        value={value}
        {...props}
      />
      {hasMatches ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-lg border border-transparent px-2.5 py-2 text-base leading-5 wrap-break-word whitespace-pre-wrap md:text-sm"
        >
          {segments.map((segment, index) => {
            if (!segment.keyword) {
              return (
                <span
                  className="text-foreground"
                  key={`${index}-${segment.text}`}
                >
                  {segment.text}
                </span>
              );
            }

            const keyword = segment.keyword;
            const previousText = segments[index - 1]?.text ?? "";
            const nextText = segments[index + 1]?.text ?? "";
            const precededByPunctuation = /\p{P}$/u.test(previousText);
            const followedByPunctuation = /^\p{P}/u.test(nextText);
            const label = (
              <mark
                className={cn(
                  "pointer-events-auto cursor-help rounded-[5px] bg-blue-500/10 text-blue-700 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.65),inset_0_1px_2px_rgb(255_255_255_/_0.9),inset_0_-1px_2px_rgb(37_99_235_/_0.12)] dark:bg-blue-400/15 dark:text-blue-300 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.14),inset_0_1px_2px_rgb(255_255_255_/_0.12),inset_0_-1px_2px_rgb(15_23_42_/_0.35)]",
                  !precededByPunctuation && "-ml-0.5 pl-0.5",
                  !followedByPunctuation && "-mr-0.5 pr-0.5"
                )}
                tabIndex={-1}
              >
                {segment.text}
              </mark>
            );

            return (
              <HoverCard key={`${index}-${segment.text}`}>
                <HoverCardTrigger
                  closeDelay={0}
                  delay={GEO_TRAFFIC_HOVER_DELAY_MS}
                  render={label}
                />
                <TrafficBreakdownCard
                  aside="Last 28 days"
                  icon={<Google className="size-4" />}
                  title="Google Search Console"
                >
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-1.5 text-xs">
                    <dt className="text-muted-foreground">Query</dt>
                    <dd className="truncate text-right font-medium">
                      {keyword.query}
                    </dd>
                    <dt className="text-muted-foreground">Impressions</dt>
                    <dd className="text-right tabular-nums">
                      {keyword.impressions.toLocaleString("en-US")}
                    </dd>
                    <dt className="text-muted-foreground">Clicks</dt>
                    <dd className="text-right tabular-nums">
                      {keyword.clicks.toLocaleString("en-US")}
                    </dd>
                    <dt className="text-muted-foreground">Position</dt>
                    <dd className="text-right tabular-nums">
                      {keyword.position.toLocaleString("en-US", {
                        maximumFractionDigits: 1,
                      })}
                    </dd>
                  </dl>
                </TrafficBreakdownCard>
              </HoverCard>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
