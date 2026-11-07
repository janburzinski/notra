import type { siteDeployments } from "@notra/db/schema";
import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";
import { and, eq, gt, inArray, ne, or } from "drizzle-orm";

import type { LiveBuildRefs } from "../types/deployments";

/**
 * Another production build of the site that should win over a rebuild of the
 * live one: queued or building, or successful and newer (held by a rollback).
 * Takes values or columns.
 */
export function supersedesLiveBuild(
  deployment: typeof siteDeployments,
  live: LiveBuildRefs
) {
  return and(
    eq(deployment.siteId, live.siteId),
    eq(deployment.kind, "production"),
    ne(deployment.id, live.id),
    or(
      inArray(deployment.status, [...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES]),
      and(
        eq(deployment.status, "ready"),
        gt(deployment.generation, live.generation)
      )
    )
  );
}
