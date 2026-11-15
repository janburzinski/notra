import { ARTIFACT_REPO_PREFIX } from "@notra/ai/constants/artifacts";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { artifacts, codeStorageDeletions } from "@notra/db/schema";
import { getRepoStore } from "@notra/memory/repos";
import { and, asc, eq, lte } from "drizzle-orm";

import {
  CODE_STORAGE_CLEANUP_BATCH,
  CODE_STORAGE_CLEANUP_RETRY_MS,
} from "@/constants/artifacts";

function artifactExists(repoId: string) {
  if (!repoId.startsWith(ARTIFACT_REPO_PREFIX)) {
    return Promise.resolve(false);
  }
  return db.query.artifacts
    .findFirst({
      columns: { id: true },
      where: eq(artifacts.id, repoId.slice(ARTIFACT_REPO_PREFIX.length)),
    })
    .then(Boolean);
}

/**
 * Deletes the code.storage repositories of deleted artifacts. A row stays
 * until code.storage confirms, so a failure is retried on a later run.
 */
export async function cleanupCodeStorageRepos(now: Date, signal: AbortSignal) {
  const due = lte(codeStorageDeletions.nextAttemptAt, now);
  const rows = await db
    .select({ repoId: codeStorageDeletions.repoId })
    .from(codeStorageDeletions)
    .where(due)
    .orderBy(asc(codeStorageDeletions.nextAttemptAt))
    .limit(CODE_STORAGE_CLEANUP_BATCH);
  let failed = 0;
  // One at a time under one deadline, so a slow code.storage never starts
  // more deletions than the budget can finish.
  for (const { repoId } of rows) {
    if (signal.aborted) {
      break;
    }
    const mine = and(due, eq(codeStorageDeletions.repoId, repoId));
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- deletions share one deadline and stop when it ends
      if (await artifactExists(repoId)) {
        // Queued while it was created and its row landed after all.
        await db.delete(codeStorageDeletions).where(mine);
        continue;
      }
      await getRepoStore().deleteRepo(repoId, signal);
      await db.delete(codeStorageDeletions).where(mine);
    } catch (error) {
      failed += 1;
      logError("[Artifacts] Repository cleanup will retry", error, { repoId });
      await db
        .update(codeStorageDeletions)
        .set({
          nextAttemptAt: new Date(
            now.getTime() + CODE_STORAGE_CLEANUP_RETRY_MS
          ),
        })
        .where(mine)
        .catch(() => undefined);
    }
  }
  return { checked: rows.length, failed };
}
