import type { FieldScore } from "../types/eval";

export function gatesPassed(fields: readonly FieldScore[]): boolean {
  return fields.every((item) => !item.gate || item.score >= 1);
}

/**
 * 0 when any gate fails, otherwise the weighted mean of the quality fields
 * (1 when there are none, e.g. a correct skip).
 */
export function combineScore(fields: readonly FieldScore[]): number {
  if (!gatesPassed(fields)) {
    return 0;
  }
  let total = 0;
  let weights = 0;
  for (const item of fields) {
    if (item.gate) {
      continue;
    }
    const weight = item.weight ?? 1;
    total += item.score * weight;
    weights += weight;
  }
  return weights ? total / weights : 1;
}
