import { setTimeout as sleep } from "node:timers/promises";

import { db } from "@notra/db/drizzle";
import { geoMentionChecks, geoScans } from "@notra/db/schema";
import type { GeoRouterError } from "@notra/geo-core/geo/errors";
import { startGeoPromptRescan } from "@notra/geo-core/geo/programs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_WORKFLOW_SCAN_PROMPT_COMPETITORS_LIMIT,
  AUTOPILOT_WORKFLOW_SCAN_PROMPT_EXCERPT_CHARS,
  AUTOPILOT_WORKFLOW_SCAN_PROMPT_POLL_MS,
  AUTOPILOT_WORKFLOW_SCAN_PROMPT_RESULTS_LIMIT,
  AUTOPILOT_WORKFLOW_SCAN_PROMPT_WAIT_MS,
} from "@/constants/autopilot-workflows";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import type {
  AutopilotPromptScanResult,
  AutopilotPromptScanStart,
} from "@/types/autopilot-workflows";
import {
  describeAutopilotPromptScanFailure,
  summarizeAutopilotPromptScan,
} from "@/utils/autopilot-scan-prompt";

/** Starts one tracked prompt's scan, on the given engines or all tracked ones. */
export async function startAutopilotPromptScan(params: {
  organizationId: string;
  projectId?: string;
  promptId: string;
  engines?: string[];
}): Promise<AutopilotPromptScanStart> {
  const outcome = await Effect.runPromise(
    Effect.result(
      startGeoPromptRescan(params).pipe(Effect.provide(geoCoreDashboardLayer))
    )
  );
  if (outcome._tag === "Success") {
    return {
      ok: true,
      scanId: outcome.success.scanId,
      prompt: outcome.success.prompt,
    };
  }
  const failure: GeoRouterError = outcome.failure;
  return describeAutopilotPromptScanFailure(failure, params.promptId);
}

/** The scan's status once it settled, or `running` at the deadline. */
async function waitForScan(organizationId: string, scanId: string) {
  const deadline = Date.now() + AUTOPILOT_WORKFLOW_SCAN_PROMPT_WAIT_MS;
  for (;;) {
    const scan = await db.query.geoScans.findFirst({
      columns: { status: true, errorMessage: true, planSummary: true },
      where: and(
        eq(geoScans.id, scanId),
        eq(geoScans.organizationId, organizationId)
      ),
    });
    if (!scan) {
      return null;
    }
    if (scan.status !== "running" || Date.now() >= deadline) {
      return scan;
    }
    await sleep(AUTOPILOT_WORKFLOW_SCAN_PROMPT_POLL_MS);
  }
}

async function loadAnswers(
  organizationId: string,
  scanId: string
): Promise<AutopilotPromptScanResult[]> {
  const rows = await db
    .select({
      engine: geoMentionChecks.engine,
      language: geoMentionChecks.language,
      mentioned: geoMentionChecks.mentioned,
      position: geoMentionChecks.position,
      competitors: geoMentionChecks.competitors,
      excerpt: geoMentionChecks.excerpt,
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.scanId, scanId),
        eq(geoMentionChecks.organizationId, organizationId),
        isNull(geoMentionChecks.personaId),
        isNull(geoMentionChecks.sequenceId),
        eq(geoMentionChecks.turn, 0)
      )
    )
    .orderBy(asc(geoMentionChecks.engine), asc(geoMentionChecks.language))
    .limit(AUTOPILOT_WORKFLOW_SCAN_PROMPT_RESULTS_LIMIT);
  return rows.map((row) => ({
    engine: row.engine,
    language: row.language,
    mentioned: row.mentioned,
    position: row.position,
    competitors: row.competitors.slice(
      0,
      AUTOPILOT_WORKFLOW_SCAN_PROMPT_COMPETITORS_LIMIT
    ),
    excerpt: row.excerpt.slice(0, AUTOPILOT_WORKFLOW_SCAN_PROMPT_EXCERPT_CHARS),
  }));
}

/** Waits for a started prompt scan, then reads what each engine answered. */
export async function collectAutopilotPromptScan(params: {
  organizationId: string;
  scanId: string;
  prompt: string;
}) {
  const { organizationId, scanId, prompt } = params;
  const scan = await waitForScan(organizationId, scanId);
  if (!scan) {
    return null;
  }
  const results = await loadAnswers(organizationId, scanId);
  const engines = [
    ...new Set([
      ...(scan.planSummary?.engines ?? []),
      ...results.map((row) => row.engine),
    ]),
  ].sort();
  const mentions = results.filter((row) => row.mentioned).length;
  return {
    scanId,
    status: scan.status,
    finished: scan.status !== "running",
    prompt,
    engines,
    checks: results.length,
    mentions,
    mentionRate: results.length === 0 ? 0 : mentions / results.length,
    results,
    summary: summarizeAutopilotPromptScan({
      prompt,
      status: scan.status,
      errorMessage: scan.errorMessage,
      engines,
      results,
    }),
  };
}
