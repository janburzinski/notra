import { logError } from "@notra/ai/utils/server-log";
import {
  GEO_PRODUCT_SITE_CHECK_CONCURRENCY,
  GEO_PRODUCT_SITE_CHECK_RUN_BUDGET_MS,
  GEO_PRODUCT_SITE_CHECK_START_DEADLINE_MS,
} from "@notra/geo-core/constants/geo";
import {
  checkGeoProductsOnSite,
  findDueGeoProductSiteChecks,
} from "@notra/geo-core/geo/product-site-check";
import { Effect } from "effect";

/**
 * Checks the websites of projects due this week for newly launched products,
 * a few at a time. Every check works within the run's budget and is cut off
 * at its end, so a run never outlasts the function limit; projects that
 * didn't finish stay due for the next hourly run.
 */
export async function runDueGeoProductSiteChecks(now = new Date()) {
  const due = await Effect.runPromise(findDueGeoProductSiteChecks(now));
  const startedAt = Date.now();
  const startBy = startedAt + GEO_PRODUCT_SITE_CHECK_START_DEADLINE_MS;
  const deadline = startedAt + GEO_PRODUCT_SITE_CHECK_RUN_BUDGET_MS;
  let checked = 0;
  let failed = 0;
  let added = 0;
  let skipped = 0;
  let next = 0;
  const worker = async () => {
    while (next < due.length) {
      const project = due[next];
      next += 1;
      if (!project) {
        continue;
      }
      if (Date.now() > startBy) {
        skipped++;
        continue;
      }
      try {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- a worker checks its projects one at a time; workers run in parallel
        const result = await Effect.runPromise(
          checkGeoProductsOnSite(project, deadline).pipe(
            // Last resort; the check itself already stops before the deadline.
            Effect.timeout(Math.max(0, deadline - Date.now()))
          )
        );
        checked++;
        added += result.added.length;
      } catch (error) {
        failed++;
        logError("[GEO] Product site check failed", error, {
          projectId: project.projectId,
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: GEO_PRODUCT_SITE_CHECK_CONCURRENCY }, worker)
  );
  return { checked, failed, added, skipped };
}
