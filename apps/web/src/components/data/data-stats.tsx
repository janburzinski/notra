import { animate, useInView } from "motion/react";
import { useLayoutEffect, useRef } from "react";

import type { DataPageModel } from "@/types/data";
import { OTHER_KEY } from "@/utils/data";

const PERCENT = 100;
const WHOLE_FROM = 10;
const COUNT_SECONDS = 1.4;
const COUNT_STAGGER_SECONDS = 0.08;
const COUNT_EASE = [0.16, 1, 0.3, 1] as const;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface Stat {
  value: number;
  /** Fraction digits, fixed for the whole count so the figure doesn't jump. */
  decimals: number;
  suffix: string;
  label: string;
}

function formatStat(value: number, decimals: number, suffix: string): string {
  return `${value.toLocaleString("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

/** Shares as percent; small ones keep one decimal so they don't round away. */
function shareStat(share: number, label: string): Stat {
  const percent = share * PERCENT;
  return {
    value: percent,
    decimals: percent < WHOLE_FROM ? 1 : 0,
    suffix: "%",
    label,
  };
}

function pageStats(page: DataPageModel): Stat[] {
  const { crawlsPerReferral, trainingShare, markdownShare } = page.summary;
  // The market share bar's leader, so both read the same 7 days.
  const topCompany = page.shares.crawls.find(
    (segment) => segment.key !== OTHER_KEY
  );
  const stats: (Stat | null)[] = [
    crawlsPerReferral === null
      ? null
      : {
          value: crawlsPerReferral,
          decimals: crawlsPerReferral < WHOLE_FROM ? 1 : 0,
          suffix: "",
          label: "AI crawler visits for every visitor an assistant sends back.",
        },
    trainingShare === null
      ? null
      : shareStat(trainingShare, "of AI crawler visits collect training data."),
    topCompany
      ? shareStat(
          topCompany.share,
          `of AI crawler visits come from ${topCompany.label}.`
        )
      : null,
    markdownShare === null
      ? null
      : shareStat(markdownShare, "of AI crawler visits ask for Markdown."),
  ];
  return stats.filter((stat) => stat !== null);
}

/**
 * Counts up from zero the first time the figure scrolls into view. The server
 * renders the final figure, so crawlers and readers with reduced motion get it
 * as is.
 */
function CountUp({ stat, index }: { stat: Stat; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const { value, decimals, suffix } = stat;
  const final = formatStat(value, decimals, suffix);

  const zero = formatStat(0, decimals, suffix);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    // Hydrated: drop the CSS placeholder and show the real text.
    element.removeAttribute("data-zero");
    element.style.visibility = "visible";
    if (counted.current || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return;
    }
    element.textContent = zero;
    if (!inView) {
      return;
    }
    const controls = animate(0, value, {
      duration: COUNT_SECONDS,
      delay: index * COUNT_STAGGER_SECONDS,
      ease: COUNT_EASE,
      onUpdate: (current) => {
        element.textContent = formatStat(current, decimals, suffix);
      },
      onComplete: () => {
        counted.current = true;
        element.textContent = final;
      },
    });
    return () => controls.stop();
  }, [inView, value, decimals, suffix, final, zero, index]);

  // Until hydration the final figure is hidden and a CSS-only zero stands in,
  // so readers see 0 and crawlers still read the real figure. Without
  // scripting, or with reduced motion, the figure shows as is.
  return (
    <span
      className="relative before:invisible before:absolute before:left-0 before:content-[attr(data-zero)] [@media(scripting:enabled)_and_(prefers-reduced-motion:no-preference)]:invisible [@media(scripting:enabled)_and_(prefers-reduced-motion:no-preference)]:before:visible"
      data-zero={zero}
      ref={ref}
    >
      {final}
    </span>
  );
}

/** The report's headline figures in large type, between the hero and the charts. */
export function DataStats({ page }: { page: DataPageModel }) {
  const stats = pageStats(page);
  if (stats.length === 0) {
    return null;
  }
  return (
    <dl className="-mt-4 grid grid-cols-2 gap-x-6 gap-y-8 md:-mt-8 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div className="flex min-w-0 flex-col gap-2" key={stat.label}>
          <dt className="text-muted-foreground order-2 max-w-60 text-sm leading-snug text-pretty sm:text-base">
            {stat.label}
          </dt>
          <dd className="text-foreground font-display order-1 text-[2.75rem] leading-none font-medium tracking-[-0.03em] tabular-nums sm:text-6xl">
            <CountUp index={index} stat={stat} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
