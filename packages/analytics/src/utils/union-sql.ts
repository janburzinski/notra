import type { SumAcrossSourcesInput } from "../types/union-sql";

/**
 * Sums native and imported rows that share the same keys. Inner columns are
 * renamed so outer aliases never shadow the columns they aggregate.
 */
export function sumAcrossSources({
  sources,
  keys,
  sums,
  maxes = [],
  merges = {},
  tail = "",
}: SumAcrossSourcesInput): string {
  const merged = Object.keys(merges);
  const inner = sources
    .map(
      (source) =>
        `SELECT ${[
          ...keys,
          ...[...sums, ...maxes, ...merged].map(
            (column) => `${column} AS u_${column}`
          ),
        ].join(", ")} FROM ${source}`
    )
    .join("\n          UNION ALL\n          ");
  const outer = [
    ...keys,
    ...sums.map((column) => `sum(u_${column}) AS ${column}`),
    ...maxes.map((column) => `max(u_${column}) AS ${column}`),
    ...Object.entries(merges).map(
      ([column, merge]) => `${merge(`u_${column}`)} AS ${column}`
    ),
  ].join(", ");
  const group = keys.length > 0 ? `GROUP BY ${keys.join(", ")}` : "";
  return `
        SELECT ${outer}
        FROM (
          ${inner}
        )
        ${group}
        ${tail}
      `;
}
