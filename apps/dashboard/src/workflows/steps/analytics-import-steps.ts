import { getWorkflowMetadata } from "workflow";

import "@/workflows/runtime";
import { reportAnalyticsImportFailure } from "@/lib/analytics-imports/alerts";
import { importQueueTurn } from "@/lib/analytics-imports/queue";
import {
  deleteAnalyticsImportData,
  failAnalyticsImport,
  finalizeAnalyticsImport,
  planAnalyticsImport,
  runAnalyticsImportChunk,
} from "@/lib/analytics-imports/runner";
import type {
  AnalyticsImportChunkOutcome,
  AnalyticsImportPlan,
  AnalyticsImportTurn,
} from "@/types/analytics-imports";

export async function analyticsImportTurnStep(
  importId: string
): Promise<AnalyticsImportTurn> {
  "use step";
  return await importQueueTurn(importId);
}

export async function planAnalyticsImportStep(
  importId: string
): Promise<AnalyticsImportPlan | null> {
  "use step";
  return await planAnalyticsImport(importId);
}

export async function runAnalyticsImportChunkStep(
  importId: string,
  chunkStart: string,
  generation?: number
): Promise<AnalyticsImportChunkOutcome> {
  "use step";
  // A run started before generations existed has none; recovery may have
  // restarted its import before, so it is fenced by its run id instead.
  return await runAnalyticsImportChunk(
    importId,
    chunkStart,
    generation === undefined
      ? { runId: getWorkflowMetadata().workflowRunId }
      : { generation }
  );
}

export async function finalizeAnalyticsImportStep(importId: string) {
  "use step";
  await finalizeAnalyticsImport(importId);
}

export async function failAnalyticsImportStep(importId: string, error: string) {
  "use step";
  await failAnalyticsImport(importId, error);
}

export async function deleteAnalyticsImportDataStep(importId: string) {
  "use step";
  await deleteAnalyticsImportData(importId);
}

export async function reportAnalyticsImportFailureStep(
  importId: string,
  reason: string
) {
  "use step";
  await reportAnalyticsImportFailure(importId, reason);
}
