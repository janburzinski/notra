export interface SumAcrossSourcesInput {
  /** Node names or `node WHERE …` fragments, read with SELECT … FROM. */
  sources: readonly string[];
  keys: readonly string[];
  sums: readonly string[];
  maxes?: readonly string[];
  /** Columns combined by their own outer aggregate, such as merging states. */
  merges?: Readonly<Record<string, (column: string) => string>>;
  /** HAVING / ORDER BY / LIMIT clauses applied after grouping. */
  tail?: string;
}
