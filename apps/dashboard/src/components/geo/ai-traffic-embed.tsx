"use client";

import { GEO_TRAFFIC_OTHER_GROUP } from "@notra/geo-core/constants/geo";
import type { AiTrafficResponse } from "@notra/geo-core/types/geo";
import {
  toGeoTrafficPreviousTotals,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { useEffect, useMemo, useRef } from "react";
import { InstrumentEmpty } from "ui/card";
import { useTranslations } from "use-intl";

import { TrafficHero } from "@/components/geo/traffic-hero";
import { WebTrafficHero } from "@/components/geo/web-traffic-hero";
import { TRAFFIC_EMBED_RESIZE_MESSAGE } from "@/constants/traffic-embed";
import type {
  PublicTrafficEmbed,
  TrafficEmbedPart,
} from "@/types/traffic-embed";
import { groupTrafficSources } from "@/utils/ai-traffic-groups";
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

function EmbedEmpty({ message }: { message: string }) {
  return (
    <div className="border-shell-border bg-shell rounded-2xl border">
      <InstrumentEmpty message={message} seed="geo-traffic-embed" />
    </div>
  );
}

function AgentsEmbedBody({
  traffic,
  from,
  to,
  parts,
}: {
  traffic: AiTrafficResponse;
  from: string;
  to: string;
  parts: TrafficEmbedPart[];
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("geo.trafficEmbed");
  const groups = useMemo(
    () =>
      groupTrafficSources(traffic.sources).map((group) =>
        group.key === GEO_TRAFFIC_OTHER_GROUP.key
          ? { ...group, label: tCommon("labels.other") }
          : group
      ),
    [traffic.sources, tCommon]
  );
  const previousTotals = useMemo(
    () =>
      toGeoTrafficPreviousTotals(traffic.sources, traffic.previousConversions),
    [traffic.sources, traffic.previousConversions]
  );
  const days = useMemo(
    () => trafficSparklineDays(traffic.points, from, to),
    [traffic.points, from, to]
  );
  const showMetrics = parts.includes("metrics");
  // Without points there is no series to draw, so the chart part says so
  // instead of collapsing to an empty frame.
  const showEmpty = parts.includes("chart") && days.length === 0;

  return (
    <>
      {showMetrics || !showEmpty ? (
        <TrafficHero
          days={days}
          groups={groups}
          points={traffic.points}
          previousTotals={previousTotals}
          showChart={parts.includes("chart")}
          showMetrics={showMetrics}
          totals={traffic.totals}
        />
      ) : null}
      {showEmpty ? <EmbedEmpty message={t("empty")} /> : null}
    </>
  );
}

/** Public traffic chart: AI agents or web visitors, as the embed was made. */
export function AiTrafficEmbed({
  embedId,
  embed,
  parts: partsParam,
}: {
  embedId: string;
  embed: PublicTrafficEmbed;
  parts: string | undefined;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const ref = useReportHeight(embedId);
  const parts = trafficEmbedParts(partsParam);

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      {embed.source === "web" ? (
        <WebTrafficHero
          range={{ from: embed.from, to: embed.to }}
          showChart={parts.includes("chart")}
          showMetrics={parts.includes("metrics")}
          web={embed.web}
        />
      ) : (
        <AgentsEmbedBody
          from={embed.from}
          parts={parts}
          to={embed.to}
          traffic={embed.traffic}
        />
      )}
      <a
        className="text-muted-foreground hover:text-foreground self-end px-1 text-xs transition-colors"
        href="https://www.usenotra.com"
        rel="noopener"
        target="_blank"
      >
        {embed.source === "web" ? t("poweredByWeb") : t("poweredBy")}
      </a>
    </div>
  );
}
