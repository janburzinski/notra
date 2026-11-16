import { db } from "@notra/db/drizzle";
import { geoContentBriefs } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_RESCAN_AI_SEARCH_MAX_PROMPTS,
  GEO_RESCAN_SOURCE_KINDS,
} from "../constants/geo";
import type { GeoPostRescanOutcome, GeoRescanForPostInput } from "../types/geo";
import { geoLogWarn } from "../utils/geo-log";
import { geoDb } from "./effect";
import { loadGeoContentGaps } from "./gaps";
import { startGeoScanScoped } from "./programs";

const RESCAN_SOURCE_KINDS: ReadonlySet<string> = new Set(
  GEO_RESCAN_SOURCE_KINDS
);

/**
 * The prompts a brief is measured on. Prompt and gap briefs name theirs; an AI
 * search gap names the search, so its prompts come from the gaps snapshot.
 */
const rescanPromptIds = Effect.fn("geo.rescanPromptIds")(function* (
  organizationId: string,
  brief: { projectId: string; sourceKind: string; sourceId: string }
) {
  if (brief.sourceKind !== "ai_search") {
    return [brief.sourceId];
  }
  const gaps = yield* loadGeoContentGaps({
    organizationId,
    projectId: brief.projectId,
  });
  const gap = gaps.aiSearchGaps.find((row) => row.id === brief.sourceId);
  return (gap?.promptIds ?? []).slice(0, GEO_RESCAN_AI_SEARCH_MAX_PROMPTS);
});

export const requestGeoRescanForPost = Effect.fn("geo.rescanForPost")(
  function* (input: GeoRescanForPostInput) {
    const brief = yield* geoDb("brief lookup by post failed", () =>
      db.query.geoContentBriefs.findFirst({
        columns: {
          id: true,
          projectId: true,
          sourceKind: true,
          sourceId: true,
          publishedAt: true,
        },
        where: and(
          eq(geoContentBriefs.postId, input.postId),
          eq(geoContentBriefs.organizationId, input.organizationId)
        ),
      })
    );
    const skipped: GeoPostRescanOutcome = { status: "skipped", scanId: null };
    if (!brief?.sourceId || !RESCAN_SOURCE_KINDS.has(brief.sourceKind)) {
      return skipped;
    }
    const promptIds = yield* rescanPromptIds(input.organizationId, {
      projectId: brief.projectId,
      sourceKind: brief.sourceKind,
      sourceId: brief.sourceId,
    });
    if (promptIds.length === 0) {
      return skipped;
    }
    const now = new Date();
    yield* geoDb("brief publish stamp failed", () =>
      db
        .update(geoContentBriefs)
        .set({ publishedAt: brief.publishedAt ?? now, rescanRequestedAt: now })
        .where(eq(geoContentBriefs.id, brief.id))
    );

    const started = yield* Effect.result(
      startGeoScanScoped(
        { organizationId: input.organizationId, projectId: brief.projectId },
        promptIds
      )
    );
    if (started._tag === "Failure") {
      yield* geoLogWarn({
        event: "geo.rescan.deferred",
        organizationId: input.organizationId,
        projectId: brief.projectId,
        briefId: brief.id,
        promptIds,
        failure: started.failure._tag,
      });
      const deferred: GeoPostRescanOutcome = {
        status: "deferred",
        scanId: null,
      };
      return deferred;
    }

    yield* geoDb("brief rescan stamp failed", () =>
      db
        .update(geoContentBriefs)
        .set({ rescanScanId: started.success.scanId })
        .where(eq(geoContentBriefs.id, brief.id))
    );
    const outcome: GeoPostRescanOutcome = {
      status: "started",
      scanId: started.success.scanId,
    };
    return outcome;
  }
);
