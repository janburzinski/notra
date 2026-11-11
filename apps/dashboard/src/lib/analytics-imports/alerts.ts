import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { notifyWorkflowFailure } from "@/utils/workflow-failure-alert";
import { getCurrentWorkflowRunId } from "@/utils/workflow-run-id";

/**
 * Sends the failure alert of an import run with its organization, project,
 * site and provider; the monitoring sweep only knows the run id and skips a
 * run whose alert went out. Never throws, so it can't hide the failure.
 */
export async function reportAnalyticsImportFailure(
  importId: string,
  reason: string
): Promise<void> {
  const runId = getCurrentWorkflowRunId();
  if (!runId) {
    return;
  }
  const row = await db.query.analyticsImports
    .findFirst({
      columns: {
        organizationId: true,
        projectId: true,
        provider: true,
        host: true,
      },
      where: eq(analyticsImports.id, importId),
    })
    .catch(() => undefined);
  await notifyWorkflowFailure({
    runId,
    workflow: "analyticsImportWorkflow",
    organizationId: row?.organizationId,
    projectId: row?.projectId,
    websiteUrl: row?.host ? `https://${row.host}` : undefined,
    phase: row ? `${row.provider} import ${importId}` : `import ${importId}`,
    reason,
  });
}
