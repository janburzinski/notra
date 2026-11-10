import { db } from "@notra/db/drizzle";
import {
  geoScans,
  organizationNotificationSettings,
  projects,
} from "@notra/db/schema";
import type { GeoCheckScanScope } from "@notra/db/types/geo-checks";
import {
  queryGeoScanCompetitors,
  queryGeoScanPrompts,
} from "@notra/db/utils/geo-checks";
import { EMAIL_CONFIG } from "@notra/email/utils/config";
import { and, eq, ne } from "drizzle-orm";

import { GEO_FIRST_SCAN_MAX_COMPETITORS } from "@/constants/geo-recap";
import {
  loadRecipients,
  loadTopGapAction,
  sendToRecipients,
} from "@/lib/email/geo-recap";
import { sendFirstScanResultsEmail } from "@/lib/email/send";
import type { GeoRecapOrganizationResult } from "@/types/email/geo-recap";
import { buildFirstScanSummary } from "@/utils/geo-first-scan";

async function hasEarlierCompletedScan({
  projectId,
  scanId,
}: GeoCheckScanScope) {
  const [row] = await db
    .select({ id: geoScans.id })
    .from(geoScans)
    .where(
      and(
        eq(geoScans.projectId, projectId),
        eq(geoScans.status, "completed"),
        ne(geoScans.id, scanId)
      )
    )
    .limit(1);
  return row !== undefined;
}

async function geoEmailsEnabled(organizationId: string) {
  const settings = await db.query.organizationNotificationSettings.findFirst({
    where: eq(organizationNotificationSettings.organizationId, organizationId),
    columns: { dailySummary: true },
  });
  return settings?.dailySummary ?? true;
}

/**
 * Emails the org owners a baseline once a project's first scan completes.
 * Shares the GEO recap's notification setting and Brew trigger.
 */
export async function sendGeoFirstScanEmail(
  scope: GeoCheckScanScope
): Promise<GeoRecapOrganizationResult> {
  if (
    (await hasEarlierCompletedScan(scope)) ||
    !(await geoEmailsEnabled(scope.organizationId))
  ) {
    return "quiet";
  }

  const [recipients, project, prompts, competitors] = await Promise.all([
    loadRecipients(scope.organizationId),
    db.query.projects.findFirst({
      where: and(
        eq(projects.id, scope.projectId),
        eq(projects.organizationId, scope.organizationId)
      ),
      columns: { name: true },
      with: { geoSettings: { columns: { companyName: true } } },
    }),
    queryGeoScanPrompts(scope),
    // One extra so the own brand can be dropped and still leave a full list.
    queryGeoScanCompetitors(scope, GEO_FIRST_SCAN_MAX_COMPETITORS + 1),
  ]);
  if (!(recipients && project) || prompts.length === 0) {
    return "quiet";
  }

  const brandName =
    project.geoSettings?.companyName.trim() || project.name.trim();
  const summary = buildFirstScanSummary({ brandName, prompts, competitors });
  const action = await loadTopGapAction({
    organizationSlug: recipients.slug,
    projectIds: [scope.projectId],
    eyebrow: "Biggest gap to close first",
  });
  const dashboardLink = `${EMAIL_CONFIG.getAppUrl()}/${recipients.slug}/geo?project=${encodeURIComponent(scope.projectId)}`;

  return sendToRecipients(recipients.emails, (recipientEmail) =>
    sendFirstScanResultsEmail({
      recipientEmail,
      projectId: scope.projectId,
      organizationName: recipients.name,
      organizationSlug: recipients.slug,
      brandName,
      ...summary,
      action,
      dashboardLink,
    })
  );
}
