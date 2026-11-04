"use client";

import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { MCP_SHEET_ROW_HEIGHT } from "@/constants/mcp-analytics";
import type {
  McpPropertyRow,
  McpPropertyTableProps,
  McpSheetHeaderProps,
  McpTableEmptyProps,
} from "@/types/mcp-analytics";
import { mcpTableHeight } from "@/utils/mcp-analytics";

/** Empty state inside an MCP table: what is missing and how to turn it on. */
export function McpTableEmpty({ description }: McpTableEmptyProps) {
  const t = useTranslations("geo.pages.mcp");
  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Analytics01Icon}
            strokeWidth={1.5}
          />
        </EmptyMedia>
        <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Sheet header with an icon tile, like the website analytics sheets. */
export function McpSheetHeader({
  icon,
  title,
  description,
}: McpSheetHeaderProps) {
  return (
    <SheetHeader>
      <div className="flex min-w-0 items-center gap-3 pe-10">
        <span className="bg-shell border-shell-border flex size-10 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0 space-y-0.5">
          <SheetTitle>
            <span className="flex min-w-0 items-center gap-2">{title}</span>
          </SheetTitle>
          {description ? (
            <SheetDescription>
              <span className="block truncate tabular-nums">{description}</span>
            </SheetDescription>
          ) : null}
        </div>
      </div>
    </SheetHeader>
  );
}

/** Two-column detail list on the dualtone table, rows without a value dropped. */
export function McpPropertyTable({ rows }: McpPropertyTableProps) {
  const t = useTranslations("geo.pages.mcp.sessionSheet");
  const visible = rows.filter((row) => row.value !== null);
  const columns: TableColumn<McpPropertyRow>[] = [
    {
      key: "label",
      header: t("detail"),
      width: "9rem",
      cell: (row) => <span className="text-muted-foreground">{row.label}</span>,
    },
    {
      key: "value",
      header: t("value"),
      width: "1fr",
      cell: (row) => (
        <span className="min-w-0 truncate font-mono text-xs">{row.value}</span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={visible}
      getRowId={(row) => row.key}
      height={mcpTableHeight(visible.length, MCP_SHEET_ROW_HEIGHT)}
      rowHeight={MCP_SHEET_ROW_HEIGHT}
      scrollFade={false}
    />
  );
}
