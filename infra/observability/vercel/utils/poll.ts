import { metricSummary } from "../schemas/metrics.ts";
import type {
  QueryResult,
  SnapshotBudget,
  VercelApi,
} from "../types/metrics.ts";
import { metricCatalog } from "./api.ts";
import {
  appendSnapshotLine,
  metricGroups,
  metricQuery,
  metricSamples,
  platformBreakdowns,
  promLabels,
} from "./metrics.ts";

export async function pollMetrics(
  api: VercelApi,
  teamId: string,
  now = Date.now()
) {
  const catalog = await metricCatalog(api);
  const groups = metricGroups(catalog);
  const lines: string[] = [];
  let budget = { lines: 0, bytes: 0 };
  appendSnapshotLine(
    lines,
    `notra_vercel_catalog_metrics ${catalog.length}`,
    budget
  );
  appendSnapshotLine(
    lines,
    `notra_vercel_supported_metrics ${groups.reduce((total, group) => total + group.metrics.length, 0)}`,
    budget
  );
  const pending = [...groups, ...platformBreakdowns(catalog)];
  const results: QueryResult[] = [];
  let fatal: Error | undefined;
  await Promise.all(
    [0, 1].map(async () => {
      for (let group = pending.shift(); group; group = pending.shift()) {
        if (fatal) {
          return;
        }
        const labels = promLabels({ group: group.key });
        let result: QueryResult;
        let groupLines: string[] = [];
        let candidate: SnapshotBudget;
        try {
          const query = metricQuery(group, teamId, now);
          const response = await api("/metrics/v1", query.body);
          if (fatal) {
            return;
          }
          const summary = metricSummary(response);
          candidate = { ...budget };
          groupLines = metricSamples(group, query, summary, candidate);
          appendSnapshotLine(
            groupLines,
            `notra_vercel_query_has_data${labels} ${Number(groupLines.length > 0)}`,
            candidate
          );
          appendSnapshotLine(
            groupLines,
            `notra_vercel_window_end_seconds${labels} ${query.end}`,
            candidate
          );
          result = {
            group: group.key,
            ok: true,
            rows: summary.length,
          };
        } catch (error) {
          if (fatal) {
            return;
          }
          if (
            error instanceof Error &&
            /^snapshot_(line|byte)_limit$/.test(error.message)
          ) {
            fatal = error;
            return;
          }
          groupLines = [];
          candidate = { ...budget };
          const reason =
            error instanceof Error &&
            /^(http_\d{3}|invalid_query|invalid_response|invalid_dimension|series_limit|duplicate_series|response_byte_limit)$/.test(
              error.message
            )
              ? error.message
              : "request_failed";
          result = { group: group.key, ok: false, reason };
        }
        try {
          appendSnapshotLine(
            groupLines,
            `notra_vercel_query_success${labels} ${Number(result.ok)}`,
            candidate
          );
          if (!group.breakdown) {
            for (const metric of group.metrics) {
              appendSnapshotLine(
                groupLines,
                `notra_vercel_metric_query_success${promLabels({ metric: metric.id })} ${Number(result.ok)}`,
                candidate
              );
            }
          }
        } catch (error) {
          fatal =
            error instanceof Error ? error : new Error("snapshot_byte_limit");
          return;
        }
        budget = candidate;
        lines.push(...groupLines);
        results.push(result);
      }
    })
  );
  if (fatal) {
    throw fatal;
  }
  return {
    text: `${lines.join("\n")}\n`,
    results,
    catalogCount: catalog.length,
  };
}
