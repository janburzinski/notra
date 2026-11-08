"use client";

import { InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { GeoCountCell } from "@/components/geo/geo-count-cell";
import { WebAnalyticsEmpty } from "@/components/geo/web-analytics-empty";
import { WEB_TABLE_ROW_HEIGHT } from "@/constants/web-analytics";
import type {
  WebBreakdownGridProps,
  WebBreakdownRow,
  WebBreakdownTableProps,
} from "@/types/geo";
import { formatChartInteger } from "@/utils/geo-charts";
import { geoCountColumnWidth } from "@/utils/geo-count-column-width";
import { formatVisibleDuration, webTableHeight } from "@/utils/web-analytics";

function WebBreakdownGrid({
  nameHeader,
  valueHeader,
  rows,
  height,
  showFromAi = false,
  showAvgTime = false,
  compare = true,
  emptyState,
  loading = false,
  nameSortable = true,
}: WebBreakdownGridProps) {
  const t = useTranslations("geo.webVisitors");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const tableHeight = height ?? webTableHeight(rows.length);
  const columns: TableColumn<WebBreakdownRow>[] = [
    {
      key: "name",
      header: nameHeader,
      width: "1fr",
      sortable: nameSortable,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          {row.label}
        </span>
      ),
      sortValue: (row) => row.sortLabel,
    },
  ];
  if (showFromAi) {
    columns.push({
      key: "fromAi",
      header: t("columnFromAi"),
      width: "5.5rem",
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {row.fromAi ? formatChartInteger(row.fromAi, locale) : "—"}
        </span>
      ),
      sortValue: (row) => row.fromAi ?? 0,
    });
  }
  if (showAvgTime) {
    columns.push({
      key: "avgTime",
      header: t("columnAvgTime"),
      width: "5.5rem",
      align: "right",
      sortable: true,
      collapsePriority: 2,
      cell: (row) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {row.avgSeconds ? formatVisibleDuration(row.avgSeconds) : "—"}
        </span>
      ),
      sortValue: (row) => row.avgSeconds ?? 0,
    });
  }
  columns.push({
    key: "value",
    header: valueHeader,
    width: compare
      ? geoCountColumnWidth(
          rows.map((row) => ({
            value: row.value,
            previousValue: row.previous,
          })),
          locale,
          tCommon("labels.new")
        )
      : "5.5rem",
    align: "right",
    sortable: true,
    cell: (row) =>
      compare ? (
        <GeoCountCell
          label={row.sortLabel}
          previousValue={row.previous}
          unavailableHint={t("comparisonUnavailable")}
          value={row.value}
        />
      ) : (
        <span className="text-sm tabular-nums">
          {formatChartInteger(row.value, locale)}
        </span>
      ),
    sortValue: (row) => row.value,
  });
  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSort={{ key: "value", direction: "desc" }}
      emptyState={emptyState ?? <WebAnalyticsEmpty />}
      getRowId={(row) => row.key}
      height={tableHeight}
      loading={loading}
      minHeight={tableHeight}
      rowHeight={WEB_TABLE_ROW_HEIGHT}
      scrollFade={false}
    />
  );
}

export function WebBreakdownTable({ title, ...grid }: WebBreakdownTableProps) {
  return (
    <InstrumentSection eyebrow={title}>
      <WebBreakdownGrid {...grid} />
    </InstrumentSection>
  );
}
