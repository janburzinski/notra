"use client";

import type { GeoSearchGapRow } from "@notra/geo-core/types/geo";

import { formatCount } from "@/utils/format";

const QUERY_ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_5rem_4rem_4.5rem] items-center gap-3 px-3 py-2 text-sm";

/**
 * The expanded search gap: why the recommendation says what it says, and the
 * queries behind it. Lives inside the table row so the numbers stay next to
 * the row they belong to; the row keeps the write action.
 */
export function SearchGapDetail({ row }: { row: GeoSearchGapRow }) {
  const target = row.recommendation.targets[0];

  return (
    <div className="space-y-4 px-4 py-4">
      <p className="max-w-3xl text-sm leading-relaxed text-pretty">
        {row.recommendation.reason}
        {target ? (
          <>
            {" Closest page: "}
            {target.url ? (
              <a
                className="focus-visible:ring-ring rounded-sm underline underline-offset-4"
                href={target.url}
                rel="noopener"
                target="_blank"
              >
                {target.title || target.url}
              </a>
            ) : (
              <span>{target.title || "Untitled content"}</span>
            )}
            <span className="text-muted-foreground tabular-nums">
              {" "}
              ({Math.round(target.score * 100)}% match)
            </span>
          </>
        ) : null}
      </p>

      {row.queries.length > 0 ? (
        <div className="bg-background divide-y rounded-lg border">
          <div className={`${QUERY_ROW_CLASS} text-muted-foreground text-xs`}>
            <span>Query</span>
            <span className="text-right">Impressions</span>
            <span className="text-right">Clicks</span>
            <span className="text-right">Position</span>
          </div>
          {row.queries.map((query) => (
            <div className={QUERY_ROW_CLASS} key={query.query}>
              <span className="truncate" title={query.query}>
                {query.query}
              </span>
              <span className="text-right tabular-nums">
                {formatCount(query.impressions)}
              </span>
              <span className="text-right tabular-nums">
                {formatCount(query.clicks)}
              </span>
              <span className="text-right tabular-nums">
                #{query.position.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
