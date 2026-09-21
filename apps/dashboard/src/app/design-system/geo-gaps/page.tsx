"use client";

import { useState } from "react";

import { Button } from "@/components/button";
import { SearchGapDetail } from "@/components/geo/search-gap-detail";
import { Table, type TableColumn } from "@/components/motion/table";
import { DESIGN_SYSTEM_SEARCH_GAPS } from "@/constants/design-system-gaps";

import { PrototypeAnswerSheet } from "./prototype-answer-sheet";

/**
 * Mocked previews of the two content-gap surfaces: the prompt gap sheet and
 * the search gap row detail. The shipped components read live scan data, so
 * this page mirrors their layout with fixtures.
 */
const SEARCH_COLUMNS: TableColumn<
  (typeof DESIGN_SYSTEM_SEARCH_GAPS)[number]
>[] = [
  {
    key: "question",
    header: "Source question",
    width: "1fr",
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{row.prompt}</span>
        <span className="text-muted-foreground truncate text-xs">
          {row.queries.length === 1
            ? "1 search query"
            : `${row.queries.length} search queries`}
        </span>
      </span>
    ),
  },
  {
    key: "impressions",
    header: "Impressions",
    width: "7rem",
    cell: (row) => (
      <span className="tabular-nums">
        {row.impressions?.toLocaleString() ?? "—"}
      </span>
    ),
  },
  {
    key: "recommendation",
    header: "Recommendation",
    width: "9rem",
    cell: (row) => (
      <span className="text-muted-foreground text-xs capitalize">
        {row.recommendation.action}
      </span>
    ),
  },
];

export default function GeoGapsSheetDemoPage() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(
    DESIGN_SYSTEM_SEARCH_GAPS[0]?.id ?? null
  );

  return (
    <main className="bg-muted/30 min-h-screen space-y-8 p-8 lg:p-12">
      <Button onClick={() => setOpen(true)}>Prompt gap sheet</Button>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Search gaps · inline detail</h2>
        <Table
          className="rounded-2xl"
          columns={SEARCH_COLUMNS}
          data={DESIGN_SYSTEM_SEARCH_GAPS}
          getRowId={(row) => row.id}
          height={520}
          onRowClick={(row) =>
            setExpanded((current) => (current === row.id ? null : row.id))
          }
          renderRowDetail={(row) =>
            row.id === expanded ? <SearchGapDetail row={row} /> : null
          }
          rowSizing="content"
        />
      </section>

      <PrototypeAnswerSheet onOpenChange={setOpen} open={open} />
    </main>
  );
}
