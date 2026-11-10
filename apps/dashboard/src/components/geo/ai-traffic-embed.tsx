"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "use-intl";

import { TrafficEmbedChartView } from "@/components/geo/traffic-embed-charts";
import { TRAFFIC_EMBED_RESIZE_MESSAGE } from "@/constants/traffic-embed";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useLiveTrafficEmbed } from "@/lib/hooks/use-live-traffic-embed";
import type {
  PublicTrafficEmbed,
  TrafficEmbedLoadResult,
} from "@/types/traffic-embed";
import { trafficEmbedParts } from "@/utils/traffic-embed";

/**
 * Reports the content height to the framing page, where `embed.js` sizes the
 * iframe. The height isn't sensitive, so any parent may read it.
 */
function useReportHeight(embedId: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.parent === window) {
      return;
    }
    const post = () =>
      window.parent.postMessage(
        {
          type: TRAFFIC_EMBED_RESIZE_MESSAGE,
          id: embedId,
          height: Math.ceil(node.getBoundingClientRect().height),
        },
        "*"
      );
    const observer = new ResizeObserver(post);
    observer.observe(node);
    post();
    return () => observer.disconnect();
  }, [embedId]);
  return ref;
}

/** Website numbers only, so the credit doesn't promise AI analytics. */
function webOnly(embed: PublicTrafficEmbed): boolean {
  return embed.charts.every(
    (chart) =>
      chart === "countries" ||
      (chart === "traffic" && embed.data.traffic?.source === "web")
  );
}

const timeFormats = new Map<string, Intl.DateTimeFormat>();

function formatTime(iso: string, locale: string): string {
  let format = timeFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
    timeFormats.set(locale, format);
  }
  return format.format(new Date(iso));
}

/**
 * Shown in the visitor's own time zone, so it is only formatted on the
 * client, never in the server render.
 */
function UpdatedAt({ iso }: { iso: string }) {
  const t = useTranslations("geo.trafficEmbed");
  const locale = useLocale();
  const isClient = useIsClient();
  if (!isClient) {
    return null;
  }
  return (
    <>
      <time dateTime={iso}>
        {t("updatedAt", { time: formatTime(iso, locale) })}
      </time>
      <span aria-hidden="true">·</span>
    </>
  );
}

interface LiveEmbedProps {
  embedId: string;
  embed: PublicTrafficEmbed;
  parts: string | undefined;
  range: string | undefined;
  charts: string | undefined;
}

/**
 * Shown when the link is opened directly or framed by a site that isn't
 * allowed; no numbers are sent in that case.
 */
function BlockedEmbed() {
  const t = useTranslations("geo.trafficEmbed");
  return (
    <main className="text-muted-foreground flex min-h-svh items-center justify-center p-6 text-center text-sm text-balance">
      {t("blocked")}
    </main>
  );
}

export function AiTrafficEmbed({
  result,
  ...props
}: Omit<LiveEmbedProps, "embed"> & { result: TrafficEmbedLoadResult }) {
  return result.status === "blocked" ? (
    <BlockedEmbed />
  ) : (
    <LiveEmbed embed={result.embed} {...props} />
  );
}

function LiveEmbed({
  embedId,
  embed: initial,
  parts: partsParam,
  range,
  charts,
}: LiveEmbedProps) {
  const t = useTranslations("geo.trafficEmbed");
  const ref = useReportHeight(embedId);
  const parts = useMemo(() => trafficEmbedParts(partsParam), [partsParam]);
  const embed = useLiveTrafficEmbed(embedId, initial, { range, charts });

  return (
    <div className="flex flex-col gap-4" ref={ref}>
      {embed ? (
        <>
          {embed.charts.map((chart) => (
            <TrafficEmbedChartView
              chart={chart}
              data={embed.data}
              from={embed.from}
              key={chart}
              parts={parts}
              to={embed.to}
            />
          ))}
          <div className="text-muted-foreground -mt-2 flex items-center justify-end gap-2 px-1 text-xs">
            <UpdatedAt iso={embed.updatedAt} />
            <a
              className="hover:text-foreground transition-colors"
              href="https://www.usenotra.com"
              rel="noopener"
              target="_blank"
            >
              {webOnly(embed) ? t("poweredByWeb") : t("poweredBy")}
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
