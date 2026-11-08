import {
  type AggregateOptions,
  DatabaseSync,
  type SQLInputValue,
} from "node:sqlite";

import {
  GEO_CAPTURED_CURRENT_CONDITION,
  GEO_CAPTURED_PREVIOUS_CONDITION,
  GEO_CAPTURED_WINDOW_SQL,
  GEO_DAY_CURRENT_CONDITION,
  GEO_DAY_PREVIOUS_CONDITION,
  GEO_HOSTS_SQL,
} from "../constants/geo-queries";
import type { SqlitePipe, SqlitePipeParams } from "../types/sqlite-pipe";

const TEMPLATE_PARAM = /\{\{(?:String|Int32)\((\w+)(?:, [^)]*)?\)\}\}/g;
const NAMED_PARAM = /\$(\w+)/g;
const INT_BRANCH =
  /\{% if Int32\((\w+), (-?\d+)\) == (-?\d+) %\}([\s\S]*?)\{% else %\}([\s\S]*?)\{% end %\}/g;
const CURRENT = "day BETWEEN $current_from AND $current_to";
const PREVIOUS = "day BETWEEN $previous_from AND $previous_to";

function conditionalSum(): AggregateOptions<number> {
  return {
    start: 0,
    step: (total, value, condition) =>
      condition ? total + Number(value) : total,
  };
}

function distinctCount(withCondition: boolean): AggregateOptions<string> {
  return {
    start: "[]",
    step: (seen, value, condition) => {
      if (withCondition && !condition) {
        return seen;
      }
      const values: unknown[] = JSON.parse(seen);
      return values.includes(value) ? seen : JSON.stringify([...values, value]);
    },
    result: (seen) => (JSON.parse(String(seen)) as unknown[]).length,
  };
}

function addDistinct(seen: string, values: readonly unknown[]): string {
  return JSON.stringify([
    ...new Set([...(JSON.parse(seen) as unknown[]), ...values]),
  ]);
}

/** uniqExact states are JSON arrays of the distinct values seen. */
function distinctState(fromStates: boolean): AggregateOptions<string> {
  return {
    start: "[]",
    step: (seen, value, condition) => {
      if (!condition) {
        return seen;
      }
      return addDistinct(
        seen,
        fromStates ? (JSON.parse(String(value)) as unknown[]) : [value]
      );
    },
  };
}

function maxWhere(): AggregateOptions<SQLInputValue> {
  return {
    start: null,
    step: (best, value, condition) =>
      condition && (best === null || String(value) > String(best))
        ? value
        : best,
  };
}

function first(): AggregateOptions<SQLInputValue> {
  return { start: null, step: (found, value) => found ?? value };
}

/**
 * Runs a Tinybird endpoint's nodes in SQLite: earlier nodes become CTEs,
 * rollup states are plain per-row numbers (uniqExact ones JSON arrays of
 * their values) and the window is two day ranges.
 */
export function createSqlitePipeDatabase(schema: string): SqlitePipe {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  db.function("concat", { varargs: true }, (...parts) => parts.join(""));
  db.function("multiIf", { varargs: true }, (...values) => {
    for (let index = 0; index < values.length - 1; index += 2) {
      if (values[index]) {
        return values[index + 1] ?? null;
      }
    }
    return values.at(-1) ?? null;
  });
  for (const name of ["any", "anyMerge"]) {
    db.aggregate(name, first());
  }
  for (const name of ["maxIf", "maxMergeIf"]) {
    db.aggregate(name, maxWhere());
  }
  for (const name of [
    "countMergeIf",
    "uniqMergeIf",
    "countIfMergeIf",
    "uniqIfMergeIf",
    "sumIf",
  ]) {
    db.aggregate(name, conditionalSum());
  }
  db.aggregate("uniqExactStateIf", distinctState(false));
  db.aggregate("uniqExactMergeStateIf", distinctState(true));
  db.aggregate("uniqExactMerge", {
    start: "[]",
    step: (seen: string, state) =>
      addDistinct(seen, JSON.parse(String(state)) as unknown[]),
    result: (seen) => (JSON.parse(String(seen)) as unknown[]).length,
  });
  for (const name of ["countMerge", "uniqMerge"]) {
    db.aggregate(name, {
      start: 0,
      step: (total: number, value) => total + Number(value),
    });
  }
  db.aggregate("countIf", {
    start: 0,
    step: (total: number, condition) => (condition ? total + 1 : total),
  });
  db.aggregate("uniqIf", distinctCount(true));
  db.aggregate("uniqExactIf", distinctCount(true));
  db.function("if", (condition, yes, no) => (condition ? yes : no));
  db.function("ifNull", (value, fallback) => value ?? fallback);
  db.function("least", (left, right) => Math.min(Number(left), Number(right)));
  db.function("toUInt64", (value) => value);
  db.function("toDateTime", (value) => value);
  db.function("splitByChar", (_separator, value) => value);
  db.function("lowerUTF8", (value) => String(value).toLowerCase());
  db.function("startsWith", (value, prefix) =>
    String(value).startsWith(String(prefix)) ? 1 : 0
  );
  db.function("endsWith", (value, suffix) =>
    String(value).endsWith(String(suffix)) ? 1 : 0
  );
  db.function("has", (list, value) =>
    String(list ?? "")
      .split(",")
      .includes(String(value))
      ? 1
      : 0
  );
  return {
    db,
    run(endpoint, params) {
      const nodes = endpoint.options.nodes;
      const translate = (sql: string) =>
        sql
          .replaceAll(
            INT_BRANCH,
            (_match, name: string, fallback: string, expected, yes, no) =>
              Number(params?.[name] ?? fallback) === Number(expected) ? yes : no
          )
          .replaceAll(GEO_HOSTS_SQL, "AND ($hosts = '' OR has($hosts, host))")
          .replaceAll(
            GEO_CAPTURED_WINDOW_SQL,
            `AND (${CURRENT.replace("day", "captured_at")})`
          )
          .replaceAll(
            GEO_CAPTURED_CURRENT_CONDITION,
            CURRENT.replace("day", "captured_at")
          )
          .replaceAll(
            GEO_CAPTURED_PREVIOUS_CONDITION,
            PREVIOUS.replace("day", "captured_at")
          )
          .replaceAll(GEO_DAY_CURRENT_CONDITION, CURRENT)
          .replaceAll(GEO_DAY_PREVIOUS_CONDITION, PREVIOUS)
          .replaceAll("uniq(visitor_id)", "count(DISTINCT visitor_id)")
          .replaceAll(TEMPLATE_PARAM, "$$$1");
      const last = nodes.at(-1);
      if (!last) {
        throw new Error("Endpoint has no nodes");
      }
      const ctes = nodes
        .slice(0, -1)
        .map((node) => `${node._name} AS (${translate(node.sql)})`);
      const sql = `${ctes.length > 0 ? `WITH ${ctes.join(",\n")}\n` : ""}${translate(last.sql)}`;
      const used = new Set(
        Array.from(sql.matchAll(NAMED_PARAM), (match) => match[1])
      );
      const defaults: SqlitePipeParams = {
        organization_id: "org",
        project_id: "",
        include_unassigned: 0,
        site_id: "",
        hosts: "",
        path: "",
        page_paths: "",
        imports: "",
        excluded_sources: "",
        host: "",
        visitor: "",
        not_found: 0,
        limit: 50,
        dimension: "country",
        current_from: "2026-10-01",
        current_to: "2026-10-07",
        previous_from: "2026-09-24",
        previous_to: "2026-09-30",
      };
      const bound = Object.fromEntries(
        Object.entries({ ...defaults, ...params }).filter(([key]) =>
          used.has(key)
        )
      );
      return db.prepare(sql).all(bound) as Record<string, unknown>[];
    },
  };
}
