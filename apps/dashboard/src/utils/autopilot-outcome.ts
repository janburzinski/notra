import type { AutopilotPostOutcome } from "@notra/ai/types/autopilot-planner";

import {
  AUTOPILOT_OUTCOME_MIN_AI_VISITS,
  AUTOPILOT_OUTCOME_MIN_ANSWERS,
  AUTOPILOT_OUTCOME_MIN_CITATIONS,
  AUTOPILOT_OUTCOME_MISS_AFTER_DAYS,
} from "@/constants/autopilot-outcome";
import type { AutopilotEngineTally } from "@/types/autopilot-runtime";

/**
 * Before and after over the engines that answered in both windows, each
 * engine weighted the same. A pooled share moves when an engine is added,
 * dropped or fails for a while, without anything changing for the brand.
 */
export function pairedEngineRates(
  before: ReadonlyMap<string, AutopilotEngineTally>,
  after: ReadonlyMap<string, AutopilotEngineTally>
): { before: number; after: number } | null {
  const engines = [...before.keys()].filter(
    (engine) =>
      (before.get(engine)?.total ?? 0) > 0 &&
      (after.get(engine)?.total ?? 0) > 0
  );
  if (engines.length === 0) {
    return null;
  }
  const mean = (tallies: ReadonlyMap<string, AutopilotEngineTally>) =>
    engines.reduce((sum, engine) => {
      const tally = tallies.get(engine);
      return tally ? sum + tally.hits / tally.total : sum;
    }, 0) / engines.length;
  return { before: mean(before), after: mean(after) };
}

/** The share over every answer, whatever the engine; null without answers. */
export function pooledRate(tallies: ReadonlyMap<string, AutopilotEngineTally>) {
  let total = 0;
  let hits = 0;
  for (const tally of tallies.values()) {
    total += tally.total;
    hits += tally.hits;
  }
  return total > 0 ? hits / total : null;
}

/**
 * Whether a new post earned its place. Its page did not exist before the
 * merge, so citations and assistant visits need no before value: any is the
 * post's doing. A miss needs time, enough scanned answers and a traffic read
 * that worked, since a quiet month on a small project or an analytics outage
 * says nothing. Visits count since the merge, not just the last month.
 */
export function postOutcome(params: {
  mergedDaysAgo: number;
  /** Answers since the merge that cite the page; null when its URL is unknown. */
  citations: number | null;
  /** Answers scanned since the merge. */
  answers: number;
  /** Assistant fetches plus AI clicks; null when the site sends no traffic data. */
  aiVisits: number | null;
  /** The traffic read failed or was cut off: visits exist but are unknown. */
  aiVisitsUnknown: boolean;
}): AutopilotPostOutcome {
  if (
    (params.citations ?? 0) >= AUTOPILOT_OUTCOME_MIN_CITATIONS ||
    (params.aiVisits ?? 0) >= AUTOPILOT_OUTCOME_MIN_AI_VISITS
  ) {
    return "worked";
  }
  if (
    params.mergedDaysAgo >= AUTOPILOT_OUTCOME_MISS_AFTER_DAYS &&
    params.citations === 0 &&
    params.answers >= AUTOPILOT_OUTCOME_MIN_ANSWERS &&
    !params.aiVisitsUnknown &&
    (params.aiVisits ?? 0) === 0
  ) {
    return "missed";
  }
  return "too_early";
}
