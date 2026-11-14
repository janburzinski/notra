import { parsePlannerState } from "@notra/ai/utils/autopilot-planner";
import {
  MEMORY_PATHS,
  MEMORY_PRELOADED_SOFT_LIMIT_BYTES,
} from "@notra/memory/constants/memory";
import {
  deleteMemory,
  openMemorySnapshot,
  updateMemory,
} from "@notra/memory/memory";
import type { MemoryRecord } from "@notra/memory/types/records";
import { byteLength } from "@notra/memory/utils/access";
import { parseRecords, renderRecords } from "@notra/memory/utils/records";

import {
  AUTOPILOT_DISMISS_FEEDBACK_ID_MARKER,
  AUTOPILOT_FEEDBACK_INTRO,
  AUTOPILOT_FEEDBACK_MAX_NEGATIVE_SHARE,
  AUTOPILOT_FEEDBACK_TITLE_MAX_CHARS,
} from "@/constants/autopilot";
import type { AutopilotFeedbackInput } from "@/types/autopilot-memory";

function renderFeedback(records: readonly MemoryRecord[]) {
  return renderRecords({
    title: "Feedback",
    intro: AUTOPILOT_FEEDBACK_INTRO,
    records,
  });
}

function isNegativeFeedback(record: MemoryRecord) {
  return (
    record.meta.sentiment === "negative" ||
    record.id.includes(AUTOPILOT_DISMISS_FEEDBACK_ID_MARKER)
  );
}

/**
 * Feedback is preloaded into every decision, so it stays under the soft limit:
 * the oldest notes go first, the oldest negative one while negatives make up
 * more than their share. Git history keeps what was dropped.
 */
function compactFeedback(records: MemoryRecord[]) {
  const sorted = [...records].sort((a, b) =>
    String(a.meta.createdAt ?? "").localeCompare(String(b.meta.createdAt ?? ""))
  );
  while (
    sorted.length > 1 &&
    byteLength(renderFeedback(sorted)) > MEMORY_PRELOADED_SOFT_LIMIT_BYTES
  ) {
    const negatives = sorted.filter(isNegativeFeedback).length;
    const index =
      negatives > sorted.length * AUTOPILOT_FEEDBACK_MAX_NEGATIVE_SHARE
        ? sorted.findIndex(isNegativeFeedback)
        : 0;
    sorted.splice(index, 1);
  }
  return sorted;
}

/** Replaces the note with the same id, so a retraction supersedes the old words. */
export async function rememberFeedback(params: AutopilotFeedbackInput) {
  const [subject = params.text] = params.text.split("\n");
  await updateMemory({
    organizationId: params.organizationId,
    actor: "user",
    message: `Feedback from ${params.createdBy}`,
    mutate: async (snapshot) => {
      const records = parseRecords(
        await snapshot.read(MEMORY_PATHS.feedback),
        "feedback"
      ).filter((record) => record.id !== params.id);
      records.push({
        id: params.id,
        title: subject.slice(0, AUTOPILOT_FEEDBACK_TITLE_MAX_CHARS),
        body: params.text,
        meta: {
          origin: params.origin ?? "github",
          sourceUrl: params.sourceUrl,
          createdBy: params.createdBy,
          createdAt: new Date().toISOString(),
          ...(params.sentiment ? { sentiment: params.sentiment } : {}),
        },
      });
      return {
        [MEMORY_PATHS.feedback]: renderFeedback(compactFeedback(records)),
      };
    },
  });
}

/** Idempotent cleanup; the deletion outbox retains failures for the next sweep. */
export async function deleteAutopilotMemory(
  organizationId: string,
  signal?: AbortSignal
) {
  await deleteMemory(organizationId, { signal });
}

/**
 * Observation ids by what the planner made of them: evidence of a topic that
 * is ready to act on, of a dismissed or written one, or of any other topic.
 */
export async function loadTopicObservationIds(organizationId: string) {
  const ids = {
    ready: new Set<string>(),
    closed: new Set<string>(),
    known: new Set<string>(),
  };
  try {
    const snapshot = await openMemorySnapshot(organizationId);
    const state = parsePlannerState(await snapshot.read(MEMORY_PATHS.planner));
    for (const topic of state.topics) {
      let group = ids.known;
      if (topic.status === "dismissed" || topic.status === "done") {
        group = ids.closed;
      } else if (topic.status === "ready" && !topic.findingId) {
        // A topic with a finding already counts as active work.
        group = ids.ready;
      }
      for (const signal of topic.signals) {
        group.add(signal.observationId);
      }
    }
  } catch {
    // Without memory every observation is new.
  }
  return ids;
}
