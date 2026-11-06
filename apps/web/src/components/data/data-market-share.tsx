import { CompetitorLogo } from "@notra/ui/components/geo/competitor-logo";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";

import { ReportPanel } from "@/components/state-of-ai-search/report-section";
import { LOGO_OUTLINE } from "@/components/state-of-ai-search/report-ui";
import { DATA_TOOLTIP_CLASS } from "@/constants/data";
import type { DataPageModel, DataShareSegment } from "@/types/data";
import { formatRatio, formatShare } from "@/utils/data";

/** Segments narrower than this show their figure on hover only. */
const FIGURE_MIN_SHARE = 0.08;
/** Wide segments also name the company or purpose; narrower ones keep the logo. */
const NAME_MIN_SHARE = 0.2;

/** Fades from the series color for the leader to a light tint for the tail. */
const SHADES = [1, 0.72, 0.52, 0.36, 0.24, 0.14];
/** From this strength down, segment text switches from white to the foreground. */
const LIGHT_TEXT_MIN = 0.5;
/** On phones, segments narrower than this keep only the logo; the hover card has the rest. */
const PHONE_TEXT_MIN_SHARE = 0.3;
/** Keeps the hover card inside the bar near its ends, in pixels from the edge. */
const TOOLTIP_EDGE_PX = 80;

const TONES = {
  crawler: "[--tone:#8B5CF6] dark:[--tone:#9C87E3]",
  referral: "[--tone:#E89A1C] dark:[--tone:#FFB547]",
} as const;

function ShareTooltip({
  segment,
  unit,
  left,
}: {
  segment: DataShareSegment;
  unit: string;
  left: number;
}) {
  return (
    <div
      className={cn(DATA_TOOLTIP_CLASS, "-translate-x-1/2")}
      role="tooltip"
      style={{ left }}
    >
      <span className="text-foreground flex items-center gap-1.5 font-medium">
        {segment.domain ? (
          <CompetitorLogo
            className={cn("size-3.5 rounded-[3px] bg-white", LOGO_OUTLINE)}
            domain={segment.domain}
            name={segment.label}
          />
        ) : null}
        {segment.label}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {formatShare(segment.share)} {unit}
      </span>
    </div>
  );
}

function ShareBar({
  label,
  unit,
  segments,
  tone,
  onSelect,
}: {
  label: string;
  /** Completes the hover card's figure, e.g. "of crawls". */
  unit: string;
  segments: DataShareSegment[];
  tone: keyof typeof TONES;
  /** Companies open their drawer; purposes and "Other" stay static. */
  onSelect?: (key: string) => void;
}) {
  const [hovered, setHovered] = useState<{
    segment: DataShareSegment;
    left: number;
  } | null>(null);

  function show(target: HTMLElement, segment: DataShareSegment) {
    const bar = target.parentElement;
    if (!bar) {
      return;
    }
    const center = target.offsetLeft + target.offsetWidth / 2;
    const left = Math.min(
      Math.max(center, TOOLTIP_EDGE_PX),
      bar.offsetWidth - TOOLTIP_EDGE_PX
    );
    setHovered({ segment, left });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="relative min-w-0">
        <div
          aria-label={label}
          className={cn(
            "flex h-10 w-full gap-0.5 overflow-hidden rounded-[10px]",
            TONES[tone]
          )}
          // A lifted finger also "leaves", so on touch the tapped segment keeps its card.
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") {
              setHovered(null);
            }
          }}
          role="group"
        >
          {segments.map((segment, index) => {
            const strength = SHADES[index] ?? SHADES.at(-1) ?? 0;
            const dark = strength >= LIGHT_TEXT_MIN;
            const clickable = Boolean(onSelect && segment.domain);
            const active = hovered?.segment.key === segment.key;
            const narrowOnPhone = segment.share < PHONE_TEXT_MIN_SHARE;
            return (
              <button
                aria-disabled={!clickable}
                aria-label={`${segment.label}: ${formatShare(segment.share)} ${unit}`}
                className={cn(
                  "focus-visible:outline-ring flex min-w-0 items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap transition-[filter] first:rounded-l-[10px] last:rounded-r-[10px] focus-visible:outline-2 focus-visible:outline-offset-2",
                  dark ? "text-white" : "text-foreground",
                  // The leader is a light tint in dark mode, so it takes dark text there.
                  index === 0 && "dark:text-neutral-950",
                  clickable ? "cursor-pointer" : "cursor-default",
                  active && "brightness-95 dark:brightness-110"
                )}
                key={segment.key}
                onBlur={() => setHovered(null)}
                onClick={() => {
                  if (clickable) {
                    onSelect?.(segment.key);
                  }
                }}
                onFocus={(event) => show(event.currentTarget, segment)}
                onPointerEnter={(event) => show(event.currentTarget, segment)}
                type="button"
                style={{
                  flexGrow: segment.share,
                  flexBasis: 0,
                  backgroundColor: `color-mix(in oklab, var(--tone) ${Math.round(strength * 100)}%, transparent)`,
                }}
              >
                {segment.share >= FIGURE_MIN_SHARE ? (
                  <>
                    {segment.domain ? (
                      <CompetitorLogo
                        className={cn(
                          "size-4 shrink-0 rounded-[4px] bg-white",
                          LOGO_OUTLINE
                        )}
                        domain={segment.domain}
                        name={segment.label}
                      />
                    ) : null}
                    {segment.share >= NAME_MIN_SHARE || !segment.domain ? (
                      <span
                        className={cn(
                          "truncate",
                          narrowOnPhone && "max-sm:hidden"
                        )}
                      >
                        {segment.label}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "ml-auto pl-1 tabular-nums opacity-80",
                        narrowOnPhone && "max-sm:hidden"
                      )}
                    >
                      {formatShare(segment.share)}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
        {hovered ? (
          <ShareTooltip
            left={hovered.left}
            segment={hovered.segment}
            unit={unit}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Who crawls, who sends people back, and why bots come: three share bars
 * on one card, then how many pages each company crawls per visitor it sends.
 */
export function DataMarketShare({
  page,
  onSelectCompany,
}: {
  page: DataPageModel;
  onSelectCompany: (vendor: string) => void;
}) {
  return (
    <ReportPanel
      bodyClassName="flex flex-col gap-4 p-4 sm:p-5"
      footer={
        page.companies.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs sm:px-5">
            <span>Crawls per referral</span>
            {page.companies.map((row) => (
              <button
                className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                key={row.vendor}
                onClick={() => onSelectCompany(row.vendor)}
                type="button"
              >
                <CompetitorLogo
                  className={cn(
                    "size-3.5 rounded-[3px] bg-white",
                    LOGO_OUTLINE
                  )}
                  domain={row.domain}
                  name={row.vendor}
                />
                <span className="text-foreground">{row.vendor}</span>
                <span className="tabular-nums">
                  {formatRatio(row.crawlsPerReferral)}
                </span>
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <ShareBar
        label="Crawls"
        unit="of crawls"
        onSelect={onSelectCompany}
        segments={page.shares.crawls}
        tone="crawler"
      />
      <ShareBar
        label="Referrals"
        unit="of referrals"
        onSelect={onSelectCompany}
        segments={page.shares.referrals}
        tone="referral"
      />
      <ShareBar
        label="Why bots crawl"
        unit="of crawls"
        segments={page.shares.purposes}
        tone="crawler"
      />
    </ReportPanel>
  );
}
