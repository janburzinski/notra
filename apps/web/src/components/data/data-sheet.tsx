"use client";

import { CompetitorLogo } from "@notra/ui/components/geo/competitor-logo";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetScrollArea,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { useRetainedValue } from "@notra/ui/hooks/use-retained-value";
import { cn } from "@notra/ui/lib/utils";
import type { ChartColorPair } from "@notra/ui/types/charts";
import { type ReactNode, useState } from "react";

import { DataPurpose } from "@/components/data/data-cells";
import { DataSeriesChart } from "@/components/data/data-traffic-chart";
import { DataTrend } from "@/components/data/data-trend";
import { ReportBlock } from "@/components/state-of-ai-search/report-section";
import {
  LOGO_OUTLINE,
  StatStrip,
} from "@/components/state-of-ai-search/report-ui";
import {
  DATA_CRAWLER_COLOR,
  DATA_REFERRAL_COLOR,
  DATA_SURFACE_CLASS,
} from "@/constants/data";
import { REPORT_SURFACE_LIFT } from "@/constants/state-of-ai-search";
import type { DataPageModel, DataSelection, DataTraffic } from "@/types/data";
import {
  formatRatio,
  formatShare,
  formatVisits,
  relativeTrend,
  vendorDomain,
} from "@/utils/data";

type Crawler = DataPageModel["crawlers"][number];
type Assistant = DataPageModel["assistants"][number];

function Header({
  title,
  subtitle,
  domain,
}: {
  title: string;
  subtitle: ReactNode;
  domain: string | null;
}) {
  return (
    <SheetHeader className="shrink-0 border-b p-4">
      <div className="flex items-center gap-3 pr-8">
        <CompetitorLogo
          className={cn("size-9 rounded-lg bg-white", LOGO_OUTLINE)}
          domain={domain}
          name={title}
        />
        <div className="min-w-0">
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {subtitle}
          </SheetDescription>
        </div>
      </div>
    </SheetHeader>
  );
}

function SourceList({
  rows,
  onSelect,
}: {
  rows: {
    selection: DataSelection;
    label: string;
    vendor: string | null;
    detail: string;
  }[];
  onSelect: (selection: DataSelection) => void;
}) {
  return (
    <div className="border-table-shell-border bg-table-shell rounded-2xl border p-0.5">
      <ul className="border-table-card-border bg-table-card shadow-table-card divide-table-row-border divide-y overflow-hidden rounded-[14px] border">
        {rows.map((row) => (
          <li key={`${row.selection.kind}:${row.selection.id}`}>
            <button
              className="hover:bg-muted/60 focus-visible:outline-ring flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              onClick={() => onSelect(row.selection)}
              type="button"
            >
              <CompetitorLogo
                className={cn("size-5 rounded-md bg-white", LOGO_OUTLINE)}
                domain={vendorDomain(row.vendor ?? row.label)}
                name={row.label}
              />
              <span className="text-foreground min-w-0 flex-1 truncate">
                {row.label}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {row.detail}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The bot's or assistant's own traffic, in the same shell as the page's charts. */
function TrendChart({
  traffic,
  label,
  color,
}: {
  traffic: DataTraffic;
  label: string;
  color: ChartColorPair;
}) {
  const series = traffic.series.find((entry) => entry.label === label);
  if (!series) {
    return null;
  }
  return (
    <div className="border-table-shell-border bg-table-shell flex min-w-0 flex-col rounded-2xl border p-0.5">
      <div className="border-table-card-border bg-table-card shadow-table-card rounded-[14px] border p-4">
        <DataSeriesChart
          color={color}
          dataKey={series.key}
          domain={series.domain}
          label={label}
          rows={traffic.rows}
        />
      </div>
    </div>
  );
}

function companyRows(page: DataPageModel, vendor: string | null, skip: string) {
  if (!vendor) {
    return [];
  }
  return [
    ...page.crawlers
      .filter((row) => row.vendor === vendor && row.id !== skip)
      .map((row) => ({
        selection: { kind: "crawler", id: row.id } as const,
        label: row.label,
        vendor: row.vendor,
        detail: `${formatVisits(row.dailyPerSite)} / site`,
      })),
    ...page.assistants
      .filter((row) => row.vendor === vendor && row.id !== skip)
      .map((row) => ({
        selection: { kind: "assistant", id: row.id } as const,
        label: row.label,
        vendor: row.vendor,
        detail: `${formatShare(row.share)} of referrals`,
      })),
  ];
}

function CrawlerBody({
  page,
  row,
  onSelect,
}: {
  page: DataPageModel;
  row: Crawler;
  onSelect: (selection: DataSelection) => void;
}) {
  const related = companyRows(page, row.vendor, row.id);
  return (
    <>
      <Header
        domain={vendorDomain(row.vendor ?? row.label)}
        subtitle={
          <>
            {row.vendor ?? "Unknown company"}
            <DataPurpose purpose={row.purpose} />
          </>
        }
        title={row.label}
      />
      <SheetScrollArea className="flex flex-col gap-8">
        <StatStrip
          stats={[
            { label: "Share of crawls", value: formatShare(row.share) },
            {
              label: "Visits / site / day",
              value: formatVisits(row.dailyPerSite),
            },
            {
              label: "vs. prior week",
              value: <DataTrend trend={relativeTrend(row.change)} />,
            },
          ]}
        />
        <StatStrip
          stats={[
            { label: "Sites reached", value: formatShare(row.reach) },
            {
              label: "Fetches llms.txt",
              value: formatShare(row.llmsTxtReach),
            },
            {
              label: "Asks for Markdown",
              value: formatShare(row.markdownShare),
            },
          ]}
        />
        <TrendChart
          color={DATA_CRAWLER_COLOR}
          label={row.label}
          traffic={page.traffic.crawlers}
        />
        {related.length > 0 ? (
          <ReportBlock title={`More from ${row.vendor}`}>
            <SourceList onSelect={onSelect} rows={related} />
          </ReportBlock>
        ) : null}
      </SheetScrollArea>
    </>
  );
}

function AssistantBody({
  page,
  row,
  onSelect,
}: {
  page: DataPageModel;
  row: Assistant;
  onSelect: (selection: DataSelection) => void;
}) {
  const related = companyRows(page, row.vendor, row.id);
  return (
    <>
      <Header
        domain={vendorDomain(row.vendor ?? row.label)}
        subtitle={`AI assistant · ${row.vendor ?? "Unknown company"}`}
        title={row.label}
      />
      <SheetScrollArea className="flex flex-col gap-8">
        <StatStrip
          stats={[
            { label: "Share of referrals", value: formatShare(row.share) },
            {
              label: "Pages per visit",
              value:
                row.pagesPerVisit === null
                  ? "–"
                  : formatVisits(row.pagesPerVisit),
            },
            {
              label: "vs. prior 4 weeks",
              value: <DataTrend trend={relativeTrend(row.change)} />,
            },
          ]}
        />
        <TrendChart
          color={DATA_REFERRAL_COLOR}
          label={row.label}
          traffic={page.traffic.referrals}
        />
        {related.length > 0 ? (
          <ReportBlock title={`More from ${row.vendor}`}>
            <SourceList onSelect={onSelect} rows={related} />
          </ReportBlock>
        ) : null}
      </SheetScrollArea>
    </>
  );
}

/**
 * A company's share of the week, summed over all its listed bots or
 * assistants; the share bars keep only the top few companies.
 */
function weeklyVendorShare(
  rows: readonly { vendor: string | null; share: number }[],
  vendor: string
): number | null {
  const own = rows.filter((row) => row.vendor === vendor);
  return own.length > 0 ? own.reduce((sum, row) => sum + row.share, 0) : null;
}

function CompanyBody({
  page,
  vendor,
  onSelect,
}: {
  page: DataPageModel;
  vendor: string;
  onSelect: (selection: DataSelection) => void;
}) {
  const company = page.companies.find((row) => row.vendor === vendor);
  const crawlShare = weeklyVendorShare(page.crawlers, vendor);
  const referralShare = weeklyVendorShare(page.assistants, vendor);
  const related = companyRows(page, vendor, "");
  return (
    <>
      <Header
        domain={vendorDomain(vendor)}
        subtitle="AI company"
        title={vendor}
      />
      <SheetScrollArea className="flex flex-col gap-8">
        <StatStrip
          stats={[
            { label: "Share of crawls", value: formatShare(crawlShare) },
            { label: "Share of referrals", value: formatShare(referralShare) },
            {
              label: "Crawls per referral",
              value: formatRatio(company?.crawlsPerReferral ?? null),
            },
          ]}
        />
        {related.length > 0 ? (
          <ReportBlock title="Bots and assistants">
            <SourceList onSelect={onSelect} rows={related} />
          </ReportBlock>
        ) : null}
      </SheetScrollArea>
    </>
  );
}

/** Drawers that can be open at once; a pick from the topmost one replaces it. */
const MAX_SHEETS = 3;

function sameSelection(a: DataSelection, b: DataSelection): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function SheetBody({
  page,
  selection,
  onSelect,
}: {
  page: DataPageModel;
  selection: DataSelection | null;
  onSelect: (selection: DataSelection) => void;
}) {
  if (selection?.kind === "crawler") {
    const row = page.crawlers.find((entry) => entry.id === selection.id);
    return row ? (
      <CrawlerBody onSelect={onSelect} page={page} row={row} />
    ) : null;
  }
  if (selection?.kind === "assistant") {
    const row = page.assistants.find((entry) => entry.id === selection.id);
    return row ? (
      <AssistantBody onSelect={onSelect} page={page} row={row} />
    ) : null;
  }
  if (selection?.kind === "company") {
    return (
      <CompanyBody onSelect={onSelect} page={page} vendor={selection.id} />
    );
  }
  return null;
}

/**
 * One drawer of the stack. The next level is a nested `Sheet`, so it opens on
 * top and slides this one clear, like the dashboard's stacked drawers.
 */
function SheetLevel({
  page,
  stack,
  depth,
  onSelect,
  onClose,
}: {
  page: DataPageModel;
  stack: readonly DataSelection[];
  depth: number;
  onSelect: (depth: number, selection: DataSelection) => void;
  onClose: (depth: number) => void;
}) {
  const current = stack[depth] ?? null;
  const [selection, releaseSelection] = useRetainedValue(current);
  return (
    <Sheet
      onOpenChange={(open) => !open && onClose(depth)}
      onOpenChangeComplete={releaseSelection}
      open={current !== null}
    >
      <DetailSheetContent
        className={cn(REPORT_SURFACE_LIFT, DATA_SURFACE_CLASS)}
        size="md"
      >
        <SheetBody
          onSelect={(next) => onSelect(depth, next)}
          page={page}
          selection={selection}
        />
      </DetailSheetContent>
      {depth + 1 < MAX_SHEETS ? (
        <SheetLevel
          depth={depth + 1}
          onClose={onClose}
          onSelect={onSelect}
          page={page}
          stack={stack}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * The report's side drawers for bots, assistants and companies. The page
 * opens the first one; a pick inside a drawer stacks a new one on top.
 */
export function DataSheet({
  page,
  selection,
  onClose,
}: {
  page: DataPageModel;
  selection: DataSelection | null;
  onClose: () => void;
}) {
  // Drawers stacked above the page's pick; a new pick starts a fresh stack.
  const [trail, setTrail] = useState<{
    root: DataSelection | null;
    items: DataSelection[];
  }>({ root: selection, items: [] });
  const items = trail.root === selection ? trail.items : [];
  const stack = selection ? [selection, ...items] : [];

  function select(depth: number, next: DataSelection) {
    const open = stack.findIndex((entry) => sameSelection(entry, next));
    // Already open further down: close the drawers above it instead.
    if (open !== -1) {
      setTrail({ root: selection, items: items.slice(0, open) });
      return;
    }
    const keep = depth + 1 < MAX_SHEETS ? depth : depth - 1;
    setTrail({ root: selection, items: [...items.slice(0, keep), next] });
  }

  function close(depth: number) {
    if (depth === 0) {
      onClose();
      return;
    }
    setTrail({ root: selection, items: items.slice(0, depth - 1) });
  }

  return (
    <SheetLevel
      depth={0}
      onClose={close}
      onSelect={select}
      page={page}
      stack={stack}
    />
  );
}
