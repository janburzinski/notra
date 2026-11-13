import { getGscIntegration } from "@notra/ai/integrations/google-search-console";
import { db } from "@notra/db/drizzle";
import { geoSettings, projects } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import type { AutopilotRunContext } from "@/types/autopilot";

/** The brand's own name and aliases; a query naming the brand is not a phrase to target. */
export async function loadBrandTerms(
  ctx: AutopilotRunContext,
  projectId: string
) {
  const settings = await db.query.geoSettings.findFirst({
    columns: { companyName: true, aliases: true },
    where: and(
      eq(geoSettings.organizationId, ctx.organizationId),
      eq(geoSettings.projectId, projectId)
    ),
  });
  return [
    ctx.brand?.name,
    settings?.companyName,
    ...(settings?.aliases ?? []),
  ].flatMap((term) => (term?.trim() ? [term.trim()] : []));
}

/** The project's Search Console property and connection, or why it can't be read. */
export async function loadSearchConsoleConnection(
  ctx: AutopilotRunContext,
  projectId: string
) {
  const [project, integration] = await Promise.all([
    db.query.projects.findFirst({
      columns: { gscSiteUrl: true },
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, ctx.organizationId)
      ),
    }),
    getGscIntegration(ctx.organizationId),
  ]);
  if (!integration || integration.disconnectingAt) {
    return { ok: false as const, reason: "Search Console is not connected" };
  }
  if (integration.status === "reauth_required") {
    return {
      ok: false as const,
      reason: "Search Console needs to be reconnected",
    };
  }
  if (!project?.gscSiteUrl) {
    return {
      ok: false as const,
      reason: "No Search Console property is selected for this project",
    };
  }
  return { ok: true as const, integration, siteUrl: project.gscSiteUrl };
}
