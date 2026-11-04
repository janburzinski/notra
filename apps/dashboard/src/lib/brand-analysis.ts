import {
  createBrandAnalysisJob,
  createBrandAnalysisJobId,
  setBrandAnalysisJobStatus,
  updateBrandAnalysisJob,
} from "@notra/ai/jobs/brand-analysis";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { brandSettings } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { eq } from "drizzle-orm";

import { DEFAULT_BRAND_CONSTRAINT } from "@/constants/brand";
import { getTranslations } from "@/lib/i18n/server";
import { startBrandAnalysisRun } from "@/lib/workflows/start";
import type {
  DispatchBrandAnalysisInput,
  InsertBrandIdentityInput,
  QueueBrandAnalysisInput,
  QueueBrandAnalysisResult,
} from "@/types/brand-analysis";

async function insertBrandIdentity({
  organizationId,
  brandName,
  websiteUrl,
}: InsertBrandIdentityInput): Promise<{ id: string }> {
  const hasAnyBrandIdentity = await db.query.brandSettings.findFirst({
    where: eq(brandSettings.organizationId, organizationId),
    columns: { id: true },
  });

  const baseValues = {
    id: crypto.randomUUID(),
    organizationId,
    name: brandName,
    websiteUrl,
  };

  try {
    const [row] = await db
      .insert(brandSettings)
      .values({ ...baseValues, isDefault: !hasAnyBrandIdentity })
      .returning({ id: brandSettings.id });
    if (row) {
      return row;
    }
  } catch (error) {
    if (!isPgUniqueViolation(error, DEFAULT_BRAND_CONSTRAINT)) {
      throw error;
    }
  }

  const [fallback] = await db
    .insert(brandSettings)
    .values({ ...baseValues, id: crypto.randomUUID(), isDefault: false })
    .returning({ id: brandSettings.id });

  if (!fallback) {
    throw new Error("Failed to create brand identity");
  }
  return fallback;
}

async function dispatchBrandAnalysisWorkflow(
  store: NonNullable<typeof redis>,
  {
    organizationId,
    websiteUrl,
    brandIdentityId,
    jobId,
  }: DispatchBrandAnalysisInput
) {
  const now = new Date().toISOString();
  await createBrandAnalysisJob(store, {
    id: jobId,
    organizationId,
    brandIdentityId,
    status: "queued",
    step: null,
    currentStep: 0,
    totalSteps: 3,
    workflowRunId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  const result = await startBrandAnalysisRun({
    organizationId,
    url: websiteUrl,
    voiceId: brandIdentityId,
    jobId,
  });

  // The run is queued once start() resolves, so a failed bookkeeping write
  // must not roll the brand identity back.
  await updateBrandAnalysisJob(store, jobId, {
    workflowRunId: result.runId,
  }).catch((error) => {
    logError("[Onboarding] Failed to record brand analysis run id", error, {
      organizationId,
      brandIdentityId,
      jobId,
    });
  });
}

export async function queueBrandAnalysisForOnboarding({
  organizationId,
  websiteUrl,
  name,
}: QueueBrandAnalysisInput): Promise<QueueBrandAnalysisResult | null> {
  const jobId = createBrandAnalysisJobId();
  const brandName =
    name?.trim() ||
    (await getTranslations("brand.defaults"))("untitledIdentity");

  const brandIdentity = await insertBrandIdentity({
    organizationId,
    brandName,
    websiteUrl,
  });

  if (!redis) {
    return { jobId, brandIdentityId: brandIdentity.id };
  }

  // Start the run before responding: work left for after the response is
  // lost if the function stops, which left an identity nobody analyzes.
  try {
    await dispatchBrandAnalysisWorkflow(redis, {
      organizationId,
      websiteUrl,
      brandIdentityId: brandIdentity.id,
      jobId,
    });
  } catch (error) {
    logError("[Onboarding] Brand analysis workflow dispatch failed", error, {
      organizationId,
      brandIdentityId: brandIdentity.id,
      jobId,
    });
    await setBrandAnalysisJobStatus(redis, jobId, "failed", {
      step: null,
      currentStep: 0,
      totalSteps: 3,
      error:
        error instanceof Error ? error.message : "Failed to trigger workflow",
    }).catch(() => undefined);
    // Remove the identity so retrying onboarding queues the analysis again
    // instead of finding an identity and skipping it.
    await db
      .delete(brandSettings)
      .where(eq(brandSettings.id, brandIdentity.id))
      .catch((deleteError) => {
        logError(
          "[Onboarding] Failed to remove unanalyzed brand identity",
          deleteError,
          { organizationId, brandIdentityId: brandIdentity.id }
        );
      });
    throw error;
  }

  return { jobId, brandIdentityId: brandIdentity.id };
}
