"use client";

import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_EMPTY_PROMPT_RESULTS,
  GEO_EMPTY_TIMESERIES,
  GEO_SPARKLINE_MIN_POINTS,
} from "@notra/geo-core/constants/geo";
import type {
  GeoEngineFamily,
  GeoStatDeltaKind,
  GeoTimeseriesPoint,
} from "@notra/geo-core/types/geo";
import { formatAiTrafficTimestamp } from "@notra/geo-core/utils/ai-traffic";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { useRetainedValue } from "@notra/ui/hooks/use-retained-value";
import type { ChartConfig } from "@notra/ui/types/charts";
import { DataTable, type TableColumn } from "ui/table";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CompetitorLogo } from "@/components/geo/competitor-logo";
import { EngineIcon } from "@/components/geo/engine-icon";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { ProjectLogo } from "@/components/geo/project-logo";
import { PromptDetailDialog } from "@/components/geo/prompt-detail-dialog";
import { PromptMentionedInsteadCell } from "@/components/geo/prompt-mentioned-instead-cell";
import { PromptOutcomeIcon } from "@/components/geo/prompt-outcome-icon";
import { ReceiptSection } from "@/components/geo/prompt-receipt-analysis";
import { WriteDialog } from "@/components/geo/writer/write-dialog";
import { CHART_PERCENT_SCALE, CHART_PRIMARY_COLOR } from "@/constants/charts";
import {
  GEO_PROMPT_DETAIL_SURFACES,
  GEO_WRITE_DIALOG_ENTRIES,
} from "@/constants/geo-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useEngineFamilySheet } from "@/lib/hooks/use-engine-family-sheet";
import { cn } from "@/lib/utils";
import type {
  EngineFamilyBrandRow,
  EngineFamilyBrandScope,
  EngineFamilyPromptHit,
  EngineFamilySheetProps,
  GeoPromptCoverage,
} from "@/types/geo";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { geoModeFillClass, seriesColors } from "@/utils/chart-colors";
import {
  buildEngineFamilyTrendRows,
  engineFamilyAvgPosition,
  engineFamilyLastCheckedAt,
  engineFamilyStatTrends,
  engineFamilyTotals,
  formatChartPercent,
  formatMentionRate,
  mentionTrendEmptyState,
} from "@/utils/geo-charts";
import { tableHeightFor } from "@/utils/table";

const FAMILY_TOTAL_STROKE_WIDTH = 2;
const FAMILY_CHART_HEIGHT_CLASS = "h-48 w-full cursor-crosshair";
const BRAND_ROW_CLASS =
  "grid h-10 grid-cols-[1.25rem_minmax(0,1fr)_minmax(3rem,8rem)_2.5rem] items-center gap-3 border-b border-border/60 px-3.5 text-sm last:border-b-0";
const RIVAL_BAR_FILL_CLASS = "bg-foreground/25";

function Stat({
  label,
  value,
  delta,
  kind,
}: {
  label: string;
  value: string;
  delta: number | null;
  kind: GeoStatDeltaKind;
}) {
  const tGeoShared2 = useTranslations("geo.shared");
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
      <dt className="text-muted-foreground truncate text-xs">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className="text-lg leading-6 font-medium tabular-nums">
          {value}
        </span>
        <GeoStatDelta
          delta={delta}
          hint={tGeoShared2("vsFirstHalfOfThis")}
          kind={kind}
          label={label}
        />
      </dd>
    </div>
  );
}

function FamilyStats({
  family,
  points,
  promptCoverage,
}: {
  family: GeoEngineFamily;
  points: readonly GeoTimeseriesPoint[];
  promptCoverage: GeoPromptCoverage | null;
}) {
  const totals = engineFamilyTotals(family);
  const position = engineFamilyAvgPosition(family);
  const trends = engineFamilyStatTrends(points, family.family);
  const t = useTranslations("geo.engineFamilySheet");
  const tGeoShared = useTranslations("geo.shared");

  return (
    <section
      aria-label={tGeoShared("outcome")}
      className={cn(TABLE_FRAME_CLASS, "@container/stats min-w-0")}
    >
      <dl
        className={cn(
          TABLE_BODY_CLASS,
          "divide-border/60 grid grid-cols-1 divide-y @min-[30rem]/stats:grid-cols-3 @min-[30rem]/stats:divide-x @min-[30rem]/stats:divide-y-0"
        )}
      >
        <Stat
          delta={trends.ratePts}
          kind="rate"
          label={tGeoShared("brandVisibility")}
          value={totals ? formatMentionRate(totals.rate) : "—"}
        />
        <Stat
          delta={null}
          kind="mentions"
          label={t("visiblePrompts")}
          value={
            promptCoverage
              ? `${promptCoverage.mentioned}/${promptCoverage.total}`
              : "—"
          }
        />
        <Stat
          delta={trends.positionDelta}
          kind="position"
          label={tGeoShared("avgPosition")}
          value={position === null ? "—" : `#${position}`}
        />
      </dl>
    </section>
  );
}

function FamilySheetDescription({ family }: { family: GeoEngineFamily }) {
  const t = useTranslations("geo.engineFamilySheet");
  const locale = useLocale();
  const lastChecked = engineFamilyLastCheckedAt(family);
  let description =
    family.variants.length > 1
      ? t("descriptionModels")
      : t("descriptionEngine");
  if (lastChecked) {
    description = t("lastChecked", {
      time: formatAiTrafficTimestamp(lastChecked, locale),
    });
  }

  return (
    <SheetDescription className="text-xs tabular-nums">
      {description}
    </SheetDescription>
  );
}

const TREND_SERIES_KEYS = ["all"];

function FamilyTrend({
  family,
  points,
}: {
  family: GeoEngineFamily;
  points: readonly GeoTimeseriesPoint[];
}) {
  const t = useTranslations("geo.engineFamilySheet");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const rows = buildEngineFamilyTrendRows(points, family.family, locale);
  const config: ChartConfig = {
    all: {
      label: t("seriesLabel"),
      colors: seriesColors(CHART_PRIMARY_COLOR),
    },
  };
  const markIncompleteTail = rows.at(-1)?.rawDay === todayIsoDate();

  if (rows.length < GEO_SPARKLINE_MIN_POINTS) {
    return null;
  }

  return (
    <ReceiptSection title={t("trend")}>
      <div className="px-2 pt-3 pb-1">
        <EChartsAreaChart
          animation={false}
          className={FAMILY_CHART_HEIGHT_CLASS}
          config={config}
          curveType="monotone"
          data={rows}
          xDataKey="day"
        >
          <EChartsAreaChart.Grid variant="solid" />
          <EChartsAreaChart.XAxis dataKey="day" />
          <EChartsAreaChart.YAxis scale tickFormatter={formatChartPercent} />
          <EChartsAreaChart.Area
            connectNulls
            dataKey="all"
            enableBufferLine={markIncompleteTail}
            gapMissing
            strokeVariant="solid"
            strokeWidth={FAMILY_TOTAL_STROKE_WIDTH}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Tooltip
            barMax={CHART_PERCENT_SCALE}
            confine={false}
            emptyLabel={(row) =>
              tGeoShared(mentionTrendEmptyState(row, TREND_SERIES_KEYS))
            }
            labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
            labelKey="rawDay"
            layout="activity"
            position="fixed"
            roundness="xl"
            rowKeys={TREND_SERIES_KEYS}
            scrub
            valueFormatter={formatChartPercent}
          />
        </EChartsAreaChart>
      </div>
    </ReceiptSection>
  );
}

function BrandRow({
  rank,
  row,
  max,
  scope,
}: {
  rank: number;
  row: EngineFamilyBrandRow;
  max: number;
  scope: EngineFamilyBrandScope;
}) {
  const tGeoShared = useTranslations("geo.shared");
  const muted = row.mentions === 0;
  return (
    <li className={cn(BRAND_ROW_CLASS, row.own && "bg-muted/50")}>
      <span className="text-muted-foreground text-xs tabular-nums">{rank}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        {row.own ? (
          <ProjectLogo
            className="size-5 shrink-0 rounded-md"
            domain={scope.ownDomain ?? null}
            name={row.name}
          />
        ) : (
          <CompetitorLogo
            className="size-5 shrink-0 rounded-md"
            competitors={scope.competitors}
            name={row.name}
          />
        )}
        <span className="truncate">{row.name}</span>
        {row.own ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {tGeoShared("you")}
          </span>
        ) : null}
      </span>
      <GeoBar
        className="h-1.5"
        fillClassName={row.own ? geoModeFillClass("web") : RIVAL_BAR_FILL_CLASS}
        max={max}
        value={row.share}
      />
      <span
        className={cn(
          "text-right text-xs tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {formatMentionRate(row.share)}
      </span>
    </li>
  );
}

function FamilyBrands({
  rows,
  scope,
}: {
  rows: readonly EngineFamilyBrandRow[];
  scope: EngineFamilyBrandScope;
}) {
  const tGeoShared = useTranslations("geo.shared");
  if (rows.length === 0) {
    return null;
  }
  const max = rows.reduce((peak, row) => Math.max(peak, row.share), 0);

  return (
    <ReceiptSection title={tGeoShared("brandRanking")}>
      <ol>
        {rows.map((row, index) => (
          <BrandRow
            key={row.key}
            max={max}
            rank={index + 1}
            row={row}
            scope={scope}
          />
        ))}
      </ol>
    </ReceiptSection>
  );
}

function PromptHits({
  hits,
  competitors,
  onOpen,
  onWrite,
}: {
  hits: readonly EngineFamilyPromptHit[];
  competitors: EngineFamilyBrandScope["competitors"];
  onOpen: (promptId: string) => void;
  onWrite?: (hit: EngineFamilyPromptHit) => void;
}) {
  const t = useTranslations("geo.engineFamilySheet");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const promptResultLabel = (hit: EngineFamilyPromptHit): string => {
    if (hit.mentioned && hit.ownedSourceCited) {
      return tGeoShared("mentionedAndCited");
    }
    if (!hit.mentioned) {
      return tGeoShared("ownedSourceCited");
    }
    return hit.position === null ? tGeoShared("mentioned") : `#${hit.position}`;
  };
  const missed = hits.filter((hit) => !(hit.mentioned || hit.ownedSourceCited));
  const found = hits.filter((hit) => hit.mentioned || hit.ownedSourceCited);
  const promptColumn = (
    header: string
  ): TableColumn<EngineFamilyPromptHit> => ({
    key: "prompt",
    header,
    width: "1fr",
    minWidth: "8rem",
    cell: (row) => (
      <TruncateWithTooltip className="text-sm">
        {row.prompt}
      </TruncateWithTooltip>
    ),
  });
  const missedColumns: TableColumn<EngineFamilyPromptHit>[] = [
    promptColumn(t("missedTitle", { count: missed.length })),
    {
      key: "mentionedInstead",
      header: t("mentionedInsteadHeader"),
      width: "minmax(8rem,14rem)",
      cell: (row) => (
        <span className="flex min-w-0 text-sm">
          <PromptMentionedInsteadCell
            answers={row.answers}
            brands={row.mentionedInstead}
            competitors={competitors}
          />
        </span>
      ),
    },
  ];
  if (onWrite) {
    missedColumns.push({
      key: "write",
      header: "",
      width: "5.75rem",
      align: "right",
      cell: (row) => (
        <Button onClick={() => onWrite(row)} size="sm" variant="outline">
          <HugeiconsIcon data-icon="inline-start" icon={PencilEdit01Icon} />
          {tCommon("labels.write")}
        </Button>
      ),
    });
  }
  const foundColumns: TableColumn<EngineFamilyPromptHit>[] = [
    promptColumn(t("foundTitle", { count: found.length })),
    {
      key: "result",
      header: t("resultHeader"),
      width: "9rem",
      sortable: true,
      cell: (row) => {
        const label = promptResultLabel(row);
        return (
          <span
            className="flex min-w-0 items-center gap-1.5 text-sm tabular-nums"
            title={label}
          >
            <PromptOutcomeIcon mentioned />
            <span className="min-w-0 truncate">{label}</span>
          </span>
        );
      },
      sortValue: (row) => {
        if (row.mentioned) {
          return row.position ?? Number.MAX_SAFE_INTEGER - 1;
        }
        return Number.MAX_SAFE_INTEGER;
      },
    },
  ];

  return (
    <>
      {missed.length > 0 ? (
        <DataTable
          columns={missedColumns}
          data={missed}
          emptyState={t("emptyPrompts")}
          getRowId={(row) => row.promptId}
          height={tableHeightFor(missed.length)}
          onRowClick={(row) => onOpen(row.promptId)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      ) : null}
      {found.length > 0 ? (
        <DataTable
          columns={foundColumns}
          data={found}
          defaultSort={{ key: "result", direction: "asc" }}
          emptyState={t("emptyPrompts")}
          getRowId={(row) => row.promptId}
          height={tableHeightFor(found.length)}
          onRowClick={(row) => onOpen(row.promptId)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      ) : null}
    </>
  );
}

function EngineFamilySheetSession({
  family,
  timeseriesPoints = GEO_EMPTY_TIMESERIES,
  promptResults = GEO_EMPTY_PROMPT_RESULTS,
  organizationSlug,
  companyName,
  aliases,
  competitors,
  open,
  onOpenChange,
  onOpenChangeComplete,
}: Omit<EngineFamilySheetProps, "family"> & {
  family: GeoEngineFamily;
  onOpenChangeComplete: (open: boolean) => void;
}) {
  const {
    timeseriesPoints: points,
    organizationId,
    canWrite,
    name,
    selectedRow,
    selectedEngine,
    promptHits,
    promptCoverage,
    brandScope,
    brandRows,
    writeOpen,
    setWriteOpen,
    writeInitial,
    setSelectedPromptId,
    handleWrite,
  } = useEngineFamilySheet({
    family,
    timeseriesPoints,
    promptResults,
    organizationSlug,
    companyName,
    aliases,
    competitors,
  });

  return (
    <>
      <Sheet
        onOpenChange={onOpenChange}
        onOpenChangeComplete={onOpenChangeComplete}
        open={open}
      >
        <DetailSheetContent size="md">
          <SheetHeader className="shrink-0 flex-row items-center gap-3 pr-14">
            <span className="bg-shell border-shell-border flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <EngineIcon className="size-[18px]" engine={family.family} />
            </span>
            <div className="min-w-0">
              <SheetTitle>{name}</SheetTitle>
              <FamilySheetDescription family={family} />
            </div>
          </SheetHeader>
          <div className="bg-muted/20 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
            <FamilyStats
              family={family}
              points={points}
              promptCoverage={promptCoverage}
            />
            <FamilyTrend family={family} points={points} />
            <FamilyBrands rows={brandRows} scope={brandScope} />
            <PromptHits
              competitors={competitors}
              hits={promptHits}
              onOpen={setSelectedPromptId}
              onWrite={canWrite ? handleWrite : undefined}
            />
          </div>
        </DetailSheetContent>
        <PromptDetailDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSelectedPromptId(null);
            }
          }}
          initialEngine={selectedEngine}
          open={selectedRow !== null}
          organizationId={organizationId || undefined}
          row={selectedRow}
          surface={GEO_PROMPT_DETAIL_SURFACES.ENGINE_SHEET}
        />
      </Sheet>
      {organizationSlug && organizationId ? (
        <WriteDialog
          entry={GEO_WRITE_DIALOG_ENTRIES.ENGINE_SHEET}
          initial={writeInitial}
          onOpenChange={setWriteOpen}
          open={writeOpen}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
        />
      ) : null}
    </>
  );
}

export function EngineFamilySheet({
  family: familyProp,
  timeseriesPoints = GEO_EMPTY_TIMESERIES,
  promptResults = GEO_EMPTY_PROMPT_RESULTS,
  organizationSlug,
  companyName,
  aliases,
  competitors,
  open,
  onOpenChange,
}: EngineFamilySheetProps) {
  const [family, releaseFamily] = useRetainedValue(familyProp);
  if (!family) {
    return null;
  }

  return (
    <EngineFamilySheetSession
      aliases={aliases}
      companyName={companyName}
      competitors={competitors}
      family={family}
      key={family.family}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={releaseFamily}
      open={open}
      organizationSlug={organizationSlug}
      promptResults={promptResults}
      timeseriesPoints={timeseriesPoints}
    />
  );
}
