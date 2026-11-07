"use client";

import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import { DataTable } from "ui/table";
import {
  DATA_TABLE_HEADER_HEIGHT,
  DATA_TABLE_ROW_HEIGHT,
} from "ui/table/constants";

import {
  AGENT_FILE_COLUMNS,
  assistantColumns,
  crawlerColumns,
  countryColumns,
} from "@/components/data/data-columns";
import { DataHeatmap } from "@/components/data/data-heatmap";
import { DataHero } from "@/components/data/data-hero";
import { DataMarketShare } from "@/components/data/data-market-share";
import { DataSheet } from "@/components/data/data-sheet";
import { DataStats } from "@/components/data/data-stats";
import { DataTrafficCard } from "@/components/data/data-traffic-chart";
import { CtaBanner } from "@/components/landing/cta-banner";
import {
  ReportBlock,
  ReportPair,
  ReportPanel,
} from "@/components/state-of-ai-search/report-section";
import {
  DATA_CRAWLER_COLOR,
  DATA_CTA_HEADING,
  DATA_CTA_SUBCOPY,
  DATA_INGEST_GAP,
  DATA_REFERRAL_COLOR,
  DATA_SIGNUP_SOURCE,
  DATA_SURFACE_CLASS,
} from "@/constants/data";
import { REPORT_SURFACE_LIFT } from "@/constants/state-of-ai-search";
import type { DataPageModel, DataSelection } from "@/types/data";

/** Rows a table shows before its body scrolls. */
const VISIBLE_ROWS = 8;
const PAIR_VISIBLE_ROWS = 7;

function tableHeight(rows: number): number {
  return DATA_TABLE_HEADER_HEIGHT + rows * DATA_TABLE_ROW_HEIGHT;
}

function ranked<T>(rows: readonly T[]): (T & { rank: number })[] {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function Report({ page }: { page: DataPageModel }) {
  const [selection, setSelection] = useState<DataSelection | null>(null);
  const withDepth = page.assistants.some((row) => row.pagesPerVisit !== null);
  const pairHeight = tableHeight(
    Math.min(
      PAIR_VISIBLE_ROWS,
      Math.max(page.countries.length, page.agentFiles.length)
    )
  );
  return (
    <>
      <DataStats page={page} />

      <ReportBlock
        title={
          page.averageDays > 1
            ? `AI traffic · ${page.averageDays}-day average, past 60 days`
            : "AI traffic · past 60 days"
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTrafficCard
            color={DATA_CRAWLER_COLOR}
            title="AI crawler visits"
            traffic={page.traffic.crawlers}
            unit="/ site / day"
          />
          <DataTrafficCard
            color={DATA_REFERRAL_COLOR}
            title="Visitors from AI assistants"
            traffic={page.traffic.referrals}
            unit="/ site / day"
          />
        </div>
        {page.windowFrom <= DATA_INGEST_GAP.notedUntil ? (
          <p className="text-muted-foreground mt-3 text-xs text-pretty">
            {DATA_INGEST_GAP.note}
          </p>
        ) : null}
      </ReportBlock>

      <ReportBlock title="Top crawlers · past 7 days">
        <DataTable
          columns={crawlerColumns(page.crawlers[0]?.share ?? 1)}
          data={ranked(page.crawlers)}
          getRowId={(row) => row.id}
          height={tableHeight(Math.min(VISIBLE_ROWS, page.crawlers.length))}
          labels={{ table: "Top AI crawlers" }}
          onRowClick={(row) => setSelection({ kind: "crawler", id: row.id })}
          rowHeight={DATA_TABLE_ROW_HEIGHT}
        />
      </ReportBlock>

      <ReportBlock title="Top assistants · past 28 days">
        <DataTable
          columns={assistantColumns(page.assistants[0]?.share ?? 1, withDepth)}
          data={ranked(page.assistants)}
          getRowId={(row) => row.id}
          height={tableHeight(Math.min(VISIBLE_ROWS, page.assistants.length))}
          labels={{ table: "Top AI assistants" }}
          onRowClick={(row) => setSelection({ kind: "assistant", id: row.id })}
          rowHeight={DATA_TABLE_ROW_HEIGHT}
        />
      </ReportBlock>

      <ReportBlock title="Market share · past 7 days">
        <DataMarketShare
          onSelectCompany={(vendor) =>
            setSelection({ kind: "company", id: vendor })
          }
          page={page}
        />
      </ReportBlock>

      {page.countries.length > 0 || page.agentFiles.length > 0 ? (
        <ReportPair
          left={{
            title: "Top countries · past 28 days",
            children: (
              <DataTable
                columns={countryColumns(page.countries[0]?.share ?? 1)}
                data={ranked(page.countries)}
                getRowId={(row) => row.country}
                height={pairHeight}
                labels={{ table: "Top countries" }}
                minHeight={pairHeight}
                rowHeight={DATA_TABLE_ROW_HEIGHT}
              />
            ),
          }}
          right={{
            title: "Who reads llms.txt · past 28 days",
            children: (
              <DataTable
                columns={AGENT_FILE_COLUMNS}
                data={page.agentFiles}
                getRowId={(row) => row.id}
                height={pairHeight}
                labels={{ table: "Bots reading llms.txt" }}
                minHeight={pairHeight}
                onRowClick={(row) =>
                  setSelection({ kind: "crawler", id: row.id })
                }
                rowHeight={DATA_TABLE_ROW_HEIGHT}
              />
            ),
          }}
        />
      ) : null}

      {page.hours?.crawlers && page.hours.referrals ? (
        <ReportPair
          left={{
            title: "When bots crawl · past 28 days",
            children: (
              <DataHeatmap grid={page.hours.crawlers} kind="crawlers" />
            ),
          }}
          right={{
            title: "When AI sends visitors · past 28 days",
            children: (
              <DataHeatmap grid={page.hours.referrals} kind="referrals" />
            ),
          }}
        />
      ) : null}
      {page.hours?.crawlers && !page.hours.referrals ? (
        <ReportBlock title="When bots crawl · past 28 days">
          <DataHeatmap grid={page.hours.crawlers} kind="crawlers" />
        </ReportBlock>
      ) : null}
      {page.hours?.referrals && !page.hours.crawlers ? (
        <ReportBlock title="When AI sends visitors · past 28 days">
          <DataHeatmap grid={page.hours.referrals} kind="referrals" />
        </ReportBlock>
      ) : null}

      <DataSheet
        onClose={() => setSelection(null)}
        page={page}
        selection={selection}
      />
    </>
  );
}

function Unavailable() {
  return (
    <ReportPanel>
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <p className="text-foreground text-sm font-medium">
          Today's numbers aren't ready yet
        </p>
        <p className="text-muted-foreground max-w-md text-sm text-pretty">
          New data is published once a day, after the last UTC day is complete.
        </p>
      </div>
    </ReportPanel>
  );
}

export function DataView({ page }: { page: DataPageModel | null }) {
  return (
    <div
      className={cn(
        REPORT_SURFACE_LIFT,
        DATA_SURFACE_CLASS,
        "flex w-full flex-col items-center gap-16 pb-16 antialiased [font-synthesis:none] md:gap-20 md:pb-24"
      )}
    >
      <DataHero page={page} />

      <div className="flex w-full max-w-[72rem] flex-col gap-12 px-4 sm:px-6">
        {page ? <Report page={page} /> : <Unavailable />}
      </div>

      <div className="w-full px-4 sm:px-6">
        <CtaBanner
          heading={DATA_CTA_HEADING}
          signupSource={DATA_SIGNUP_SOURCE}
          subcopy={DATA_CTA_SUBCOPY}
        />
      </div>
    </div>
  );
}
