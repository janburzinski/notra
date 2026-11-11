import { FatalError, sleep } from "workflow";

import type { AnalyticsImportWorkflowPayload } from "@/types/workflows/analytics-import";

import {
  analyticsImportTurnStep,
  deleteAnalyticsImportDataStep,
  failAnalyticsImportStep,
  finalizeAnalyticsImportStep,
  planAnalyticsImportStep,
  reportAnalyticsImportFailureStep,
  runAnalyticsImportChunkStep,
} from "./steps/analytics-import-steps";

/**
 * Imports history chunk by chunk, newest first. Imports from one account
 * wait their turn first, sleeping durably until the one before them ends
 * (which wakes them). Each chunk is its own step, so a crash resumes at the
 * first unfinished one; rate limits sleep durably instead of holding
 * compute. An error that outlasts a step's retries fails the import, so it
 * never stays "running" and holds up its account's queue. Every failure
 * alerts with the import's organization, also when the cleanup fails.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function analyticsImportWorkflow(
  payload: AnalyticsImportWorkflowPayload
) {
  "use workflow";

  let reason: string | undefined;
  try {
    let turn = await analyticsImportTurnStep(payload.importId);
    while (turn.status === "waiting") {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- durable wait for the account's earlier import
      await sleep(`${turn.retryAfterSeconds}s`);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- check the queue again after the wait
      turn = await analyticsImportTurnStep(payload.importId);
    }
    const plan = await planAnalyticsImportStep(payload.importId);
    if (!plan) {
      return { status: "skipped" as const };
    }
    for (const chunkStart of plan.chunks) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- chunks run in order against one rate-limited account
      let outcome = await runAnalyticsImportChunkStep(
        payload.importId,
        chunkStart
      );
      while (outcome.status === "rate_limited") {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- durable wait for the provider's window
        await sleep(`${outcome.retryAfterSeconds}s`);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- retry the same chunk after the wait
        outcome = await runAnalyticsImportChunkStep(
          payload.importId,
          chunkStart
        );
      }
      if (outcome.status === "cancelled") {
        return { status: "cancelled" as const };
      }
      if (outcome.status === "failed") {
        reason = outcome.error;
        await failAnalyticsImportStep(payload.importId, reason);
        throw new FatalError(reason);
      }
    }
    await finalizeAnalyticsImportStep(payload.importId);
    return { status: "completed" as const, chunks: plan.chunks.length };
  } catch (error) {
    const message = errorMessage(error);
    if (reason === undefined) {
      reason = message;
      try {
        await failAnalyticsImportStep(payload.importId, reason);
      } catch (cleanupError) {
        reason = `${reason}; cleanup failed: ${errorMessage(cleanupError)}`;
      }
    } else if (message !== reason) {
      reason = `${reason}; cleanup failed: ${message}`;
    }
    await reportAnalyticsImportFailureStep(payload.importId, reason);
    throw new FatalError(reason);
  }
}

export async function analyticsImportDeleteWorkflow(
  payload: AnalyticsImportWorkflowPayload
) {
  "use workflow";

  await deleteAnalyticsImportDataStep(payload.importId);
  return { status: "deleted" as const };
}
