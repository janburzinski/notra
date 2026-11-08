import type { TraceEvent } from "./types";

const SCRIPT_EVENTS = new Set(["EvaluateScript", "v8.compile", "FunctionCall"]);
export const INTERACTION_MARK = "bench:interact";

/**
 * Main-thread time spent in one script, split at the interaction mark. Nested
 * events (a FunctionCall inside an EvaluateScript) are only counted once, and
 * anything the script forces synchronously (style, layout) is included
 * because it runs inside the script's own events.
 */
export function scriptTime(events: TraceEvent[], url: string) {
  const mark = events.find((event) => event.name === INTERACTION_MARK)?.ts;
  const own = events
    .filter(
      (event) =>
        SCRIPT_EVENTS.has(event.name) &&
        event.ph === "X" &&
        event.dur !== undefined &&
        event.args?.data?.url === url
    )
    .sort((a, b) => a.ts - b.ts);
  let loadUs = 0;
  let interactionUs = 0;
  const coveredUntil = new Map<string, number>();
  for (const event of own) {
    const thread = `${event.pid}:${event.tid}`;
    const end = event.ts + (event.dur ?? 0);
    const covered = coveredUntil.get(thread) ?? 0;
    if (end <= covered) {
      continue;
    }
    const added = end - Math.max(event.ts, covered);
    coveredUntil.set(thread, end);
    if (mark !== undefined && event.ts >= mark) {
      interactionUs += added;
    } else {
      loadUs += added;
    }
  }
  return { loadMs: loadUs / 1000, interactionMs: interactionUs / 1000 };
}
