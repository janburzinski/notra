import "@/workflows/runtime";
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
  chunkStart: string
): Promise<AnalyticsImportChunkOutcome> {
  "use step";
  return await runAnalyticsImportChunk(importId, chunkStart);
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
