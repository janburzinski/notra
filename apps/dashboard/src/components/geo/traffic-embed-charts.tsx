"use client";

import {
  GEO_SPARKLINE_MIN_POINTS,
  GEO_TRAFFIC_OTHER_GROUP,
} from "@notra/geo-core/constants/geo";
import type {
  AiTrafficResponse,
  GeoLanguageSharePoint,
} from "@notra/geo-core/types/geo";
import {
  toGeoTrafficPreviousTotals,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import { memo, type ReactNode, useMemo } from "react";
import { InstrumentEmpty, InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { GeoRateSparkline } from "@/components/geo/geo-rate-sparkline";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { ProjectLogo } from "@/components/geo/project-logo";
import { CountryFlag, Twemoji } from "@/components/geo/twemoji";
import { WebBreakdownTable } from "@/components/geo/web-breakdown-table";
import { LANGUAGE_FLAGS } from "@/constants/language-flags";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { TRAFFIC_EMBED_CHART_SOURCES } from "@/constants/traffic-embed";
import { useLanguageLabel } from "@/lib/hooks/use-language-label";
import type { WebBreakdownRow } from "@/types/geo";
import type {
  PublicTrafficEmbed,
  TrafficEmbedChart,
  TrafficEmbedPart,
  TrafficEmbedShareOfVoiceRow,
  TrafficEmbedSourceData,
} from "@/types/traffic-embed";
import { groupTrafficSources } from "@/utils/ai-traffic-groups";
import { countryName } from "@/utils/country";
import { formatMentionRate, mentionCountDelta } from "@/utils/geo-charts";
import dynamic from "@/utils/lazy-component";
import { contentTableHeightFor } from "@/utils/table";

// Each chart loads its own code, so an embed of tables never downloads the
// chart library. They still render on the server.
const TrafficHero = dynamic(() =>
  import("@/components/geo/traffic-hero").then((module) => module.TrafficHero)
);
const WebTrafficHero = dynamic(() =>
  import("@/components/geo/web-traffic-hero").then(
    (module) => module.WebTrafficHero
  )
);
const MentionTrendCard = dynamic(() =>
  import("@/components/geo/mention-trend-card").then(
    (module) => module.MentionTrendCard
  )
);
const EngineRateTable = dynamic(() =>
  import("@/components/geo/engine-rate-table").then(
    (module) => module.EngineRateTable
  )
);

const EMBED_EMPTY_CLASS = "border-shell-border bg-shell rounded-2xl border";

function EmbedEmpty({ message, seed }: { message: string; seed: string }) {
  return (
    <div className={EMBED_EMPTY_CLASS}>
      <InstrumentEmpty message={message} seed={seed} />
    </div>
  );
}

function AgentsTrafficChart({
  from,
  to,
  traffic,
  parts,
}: {
  from: string;
  to: string;
  traffic: AiTrafficResponse;
  parts: readonly TrafficEmbedPart[];
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
      {showEmpty ? (
        <EmbedEmpty message={t("empty")} seed="geo-traffic-embed" />
      ) : null}
    </>
  );
}

function ShareOfVoiceChart({ rows }: { rows: TrafficEmbedShareOfVoiceRow[] }) {
  const t = useTranslations("geo.trafficEmbed");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const labelled = useMemo(
    () =>
      rows.map((row) =>
        row.kind === "aggregate"
          ? { ...row, brand: tGeoShared("otherBrands") }
          : row
      ),
    [rows, tGeoShared]
  );
  const maxShare = labelled.reduce((max, row) => Math.max(max, row.share), 0);
  const columns: TableColumn<TrafficEmbedShareOfVoiceRow>[] = [
    {
      key: "brand",
      header: tCommon("labels.brand"),
      width: "1fr",
      sortable: true,
      sortValue: (row) => row.brand,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          {row.kind === "brand" ? (
            // No domain: the logo stays a generated avatar or engine icon,
            // so the visitor's browser makes no logo requests.
            <ProjectLogo
              className="size-4 shrink-0 rounded-sm"
              domain={null}
              name={row.brand}
            />
          ) : null}
          <span className={row.own ? "truncate font-medium" : "truncate"}>
            {row.brand}
          </span>
        </span>
      ),
    },
    {
      key: "share",
      header: tGeoShared("share"),
      width: "1.3fr",
      sortable: true,
      sortValue: (row) => row.share,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <GeoBar
            className="h-2 max-w-40"
            fillColor={row.color.light}
            max={maxShare}
            value={row.share}
          />
          <span className="shrink-0 text-xs tabular-nums">
            {formatMentionRate(row.share)}
          </span>
        </span>
      ),
    },
    {
      key: "mentions",
      header: tGeoShared("mentionsLabel"),
      collapsePriority: 1,
      width: "10.5rem",
      sortable: true,
      sortValue: (row) => row.mentions,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-right text-sm tabular-nums">
            {row.mentions.toLocaleString(locale)}
          </span>
          <GeoStatDelta
            delta={mentionCountDelta(row.mentionTrend)}
            hint={tGeoShared("vsFirstHalfOfThis")}
            label={tGeoShared("brandMentions", { brand: row.brand })}
          />
        </span>
      ),
    },
    {
      key: "trend",
      header: tGeoShared("trendLabel"),
      collapsePriority: 2,
      width: "5.5rem",
      cell: (row) =>
        row.trend.length < GEO_SPARKLINE_MIN_POINTS ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <GeoRateSparkline color={row.color.light} points={row.trend} />
        ),
    },
  ];

  return (
    <InstrumentSection
      bodyClassName="flex min-h-0 flex-1 flex-col"
      eyebrow={tGeoShared("shareOfVoice")}
    >
      {labelled.length === 0 ? (
        <InstrumentEmpty
          className="h-full"
          message={t("emptyVisibility")}
          seed="Share of voice"
        />
      ) : (
        // Server order: brands by share, "other brands" last.
        <DataTable
          columns={columns}
          data={labelled}
          getRowId={(row) => row.id}
          height={contentTableHeightFor(labelled.length)}
          minHeight={contentTableHeightFor(labelled.length)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      )}
    </InstrumentSection>
  );
}

function LanguagesChart({ points }: { points: GeoLanguageSharePoint[] }) {
  const t = useTranslations("geo.trafficEmbed");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const languageLabel = useLanguageLabel();
  const columns: TableColumn<GeoLanguageSharePoint>[] = [
    {
      key: "language",
      header: tCommon("labels.language"),
      width: "1fr",
      sortable: true,
      sortValue: (row) => languageLabel(row.language),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <Twemoji
            className="size-4 shrink-0"
            emoji={
              LANGUAGE_FLAGS[row.language as keyof typeof LANGUAGE_FLAGS] ?? ""
            }
            label={languageLabel(row.language)}
          />
          <span className="min-w-0 truncate font-medium">
            {languageLabel(row.language)}
          </span>
        </span>
      ),
    },
    {
      key: "visibility",
      header: tGeoShared("brandVisibility"),
      width: "1.3fr",
      sortable: true,
      sortValue: (row) => row.visibilityRate ?? row.mentionRate,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <GeoBar
            className="h-2 max-w-40"
            fillClassName="bg-geo-search"
            value={row.visibilityRate ?? row.mentionRate}
          />
          <span className="shrink-0 text-xs tabular-nums">
            {formatMentionRate(row.visibilityRate ?? row.mentionRate)}
          </span>
        </span>
      ),
    },
    {
      key: "trend",
      collapsePriority: 1,
      header: tGeoShared("trendLabel"),
      width: "7.5rem",
      cell: (row) =>
        (row.trend?.length ?? 0) < GEO_SPARKLINE_MIN_POINTS ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <GeoRateSparkline
            className="text-geo-search"
            points={row.trend ?? []}
          />
        ),
    },
  ];

  return (
    <InstrumentSection
      bodyClassName="flex min-h-0 flex-1 flex-col"
      eyebrow={tGeoShared("performanceByLanguage")}
    >
      {points.length === 0 ? (
        <InstrumentEmpty
          className="h-full"
          message={t("emptyVisibility")}
          seed="Languages"
        />
      ) : (
        <DataTable
          columns={columns}
          data={points}
          defaultSort={{ key: "visibility", direction: "desc" }}
          getRowId={(row) => row.language}
          height={contentTableHeightFor(points.length)}
          minHeight={contentTableHeightFor(points.length)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      )}
    </InstrumentSection>
  );
}

function CountriesChart({
  countries,
}: {
  countries: TrafficEmbedSourceData["countries"];
}) {
  const t = useTranslations("geo.trafficEmbed");
  const tWeb = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const rows: WebBreakdownRow[] = countries.map((row) => {
    const name = row.value
      ? countryName(row.value, locale)
      : tWeb("unknownCountry");
    return {
      key: row.value || "unknown",
      label: (
        <>
          {row.value ? (
            <CountryFlag className="size-3.5" code={row.value} />
          ) : null}
          <span className="truncate">{name}</span>
        </>
      ),
      sortLabel: name,
      value: row.visitors,
      previous: row.previousVisitors,
    };
  });
  return (
    <WebBreakdownTable
      emptyState={t("emptyCountries")}
      nameHeader={tWeb("columnCountry")}
      rows={rows}
      title={tWeb("countries")}
      valueHeader={tWeb("visitors")}
    />
  );
}

/** True when every source the chart reads loaded. */
function hasChartData(
  chart: TrafficEmbedChart,
  data: PublicTrafficEmbed["data"]
): boolean {
  return TRAFFIC_EMBED_CHART_SOURCES[chart].every(
    (source) => data[source] !== undefined
  );
}

interface ChartRenderProps {
  data: PublicTrafficEmbed["data"];
  from: string;
  to: string;
  parts: readonly TrafficEmbedPart[];
}

function TrafficChart({ data, from, to, parts }: ChartRenderProps) {
  if (!data.traffic) {
    return null;
  }
  return data.traffic.source === "web" ? (
    <WebTrafficHero
      range={{ from, to }}
      showChart={parts.includes("chart")}
      showMetrics={parts.includes("metrics")}
      web={data.traffic.web}
    />
  ) : (
    <AgentsTrafficChart
      from={from}
      parts={parts}
      to={to}
      traffic={data.traffic.traffic}
    />
  );
}

function VisibilityChart({ data }: ChartRenderProps) {
  const t = useTranslations("geo.trafficEmbed");
  // The card fills its parent; on the dashboard a grid row sets that
  // height, here this wrapper does.
  return data.timeseries && data.timeseries.length > 0 ? (
    <div className="h-80">
      <MentionTrendCard points={data.timeseries} />
    </div>
  ) : (
    <EmbedEmpty message={t("emptyVisibility")} seed="embed-visibility" />
  );
}

function EnginesChart({ data }: ChartRenderProps) {
  const t = useTranslations("geo.trafficEmbed");
  return data.overview && data.overview.length > 0 ? (
    <EngineRateTable
      engines={data.overview}
      readOnly
      timeseriesPoints={data.timeseries}
    />
  ) : (
    <EmbedEmpty message={t("emptyVisibility")} seed="embed-engines" />
  );
}

const CHART_VIEWS: Record<
  TrafficEmbedChart,
  (props: ChartRenderProps) => ReactNode
> = {
  traffic: TrafficChart,
  visibility: VisibilityChart,
  engines: EnginesChart,
  "share-of-voice": ({ data }) => (
    <ShareOfVoiceChart rows={data.shareOfVoice ?? []} />
  ),
  languages: ({ data }) => <LanguagesChart points={data.languages ?? []} />,
  countries: ({ data }) => <CountriesChart countries={data.countries ?? []} />,
};

/**
 * Memoized on `data`: a live embed keeps the same object while the numbers
 * are unchanged, so polls that bring nothing new don't redraw the charts.
 */
export const TrafficEmbedChartView = memo(function TrafficEmbedChartView({
  chart,
  ...props
}: ChartRenderProps & { chart: TrafficEmbedChart }) {
  const t = useTranslations("geo.trafficEmbed");
  if (!hasChartData(chart, props.data)) {
    return <EmbedEmpty message={t("unavailable")} seed={`embed-${chart}`} />;
  }
  const View = CHART_VIEWS[chart];
  return <View {...props} />;
});
