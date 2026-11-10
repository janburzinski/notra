import { ABUSE_ACTION_RETENTION_DAYS } from "@notra/db/constants/abuse";
import { SLACK_AGENT_REQUEST_RETENTION_DAYS } from "@notra/db/constants/slack-agent";
import { db } from "@notra/db/drizzle";
import {
  abuseActions,
  sites,
  siteWebhookDeliveries,
  slackAgentRequests,
} from "@notra/db/schema";
import { cleanupSiteDeployments } from "@notra/sites-server/cleanup";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { isDemoMode } from "@notra/utils/demo-mode";
import { lt, sql } from "drizzle-orm";

import { SITES_CLEANUP_CONCURRENCY } from "@/constants/sites";
import { sweepImportUploads } from "@/lib/analytics-imports/storage";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  let deleted = 0;
  const failed: string[] = [];
  const allSites = await db.select({ id: sites.id }).from(sites);
  await mapWithConcurrency(
    allSites,
    SITES_CLEANUP_CONCURRENCY,
    async (site) => {
      try {
        deleted += (await cleanupSiteDeployments(site.id)).deleted.length;
      } catch (error) {
        failed.push(site.id);
        console.error("sites.cleanup_failed", {
          siteId: site.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  );
  await db
    .delete(siteWebhookDeliveries)
    .where(
      lt(siteWebhookDeliveries.receivedAt, sql`now() - interval '14 days'`)
    );
  await db
    .delete(abuseActions)
    .where(
      lt(
        abuseActions.createdAt,
        sql`now() - make_interval(days => ${ABUSE_ACTION_RETENTION_DAYS})`
      )
    );
  await db
    .delete(slackAgentRequests)
    .where(
      lt(
        slackAgentRequests.createdAt,
        sql`now() - make_interval(days => ${SLACK_AGENT_REQUEST_RETENTION_DAYS})`
      )
    );
  const importUploads = await sweepImportUploads().catch((error) => {
    console.error("analytics_imports.upload_sweep_failed", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  });
  return Response.json(
    { deleted, failed, importUploads },
    { status: failed.length > 0 || importUploads === null ? 500 : 200 }
  );
}
