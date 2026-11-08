import type { DatabaseSync } from "node:sqlite";

export type SqlitePipeParams = Record<string, string | number>;

export interface SqlitePipeEndpoint {
  options: { nodes: readonly { _name: string; sql: string }[] };
}

export interface SqlitePipe {
  db: DatabaseSync;
  run(
    endpoint: SqlitePipeEndpoint,
    params?: SqlitePipeParams
  ): Record<string, unknown>[];
}
