import { type Column, inArray } from "drizzle-orm";

import type {
  StatusSources,
  StatusTransitions,
} from "@/types/status-transition";

export function statusTransition<
  Table extends StatusTransitions<string>,
  To extends Table[keyof Table][number],
>(
  column: Column,
  transitions: Table,
  to: To,
  from: readonly Extract<StatusSources<Table, To>, string>[]
) {
  const table: StatusTransitions<string> = transitions;
  const invalid = from.find((status) => !table[status]?.includes(to));
  if (invalid) {
    throw new Error(`Status cannot move from ${invalid} to ${to}`);
  }
  return inArray(column, [...from]);
}
