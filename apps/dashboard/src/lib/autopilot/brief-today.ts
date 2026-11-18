import { db } from "@notra/db/drizzle";
import { autopilotBriefs, autopilotSettings } from "@notra/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

import { AUTOPILOT_BRIEF_PREVIEW_ITEMS } from "@/constants/autopilot-brief";
import { loadBriefFindings } from "@/lib/autopilot/brief-page";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { autopilotBriefPath } from "@/utils/autopilot-brief";
import { autopilotLocalDayStart } from "@/utils/autopilot-schedule";

/**
 * Today's brief, for the sidebar card: only while Autopilot is switched on
 * and only one written since midnight in the workspace's timezone, so
 * yesterday's never lingers. The first items it lists come along for the
 * preview, in the order the brief reads them.
 */
export async function loadTodayBrief(organizationId: string, now = new Date()) {
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { enabled: true, timezone: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  if (!settings?.enabled) {
    return null;
  }
  const [brief, enabled] = await Promise.all([
    db.query.autopilotBriefs.findFirst({
      columns: { id: true, content: true, createdAt: true },
      where: and(
        eq(autopilotBriefs.organizationId, organizationId),
        gte(
          autopilotBriefs.createdAt,
          autopilotLocalDayStart(settings.timezone, now)
        )
      ),
      orderBy: [desc(autopilotBriefs.createdAt)],
    }),
    isAutopilotEnabledForOrganization(organizationId),
  ]);
  if (!(brief && enabled)) {
    return null;
  }

  const { content } = brief;
  const order = [
    ...new Set([
      ...(content.lead ? [content.lead.findingId] : []),
      ...content.findingIds,
      ...content.mergedIds,
    ]),
  ];
  const rows = new Map(
    (await loadBriefFindings(organizationId, content)).map((row) => [
      row.id,
      row,
    ])
  );
  const items = order
    .flatMap((id) => {
      const row = rows.get(id);
      return row ? [{ id, title: row.title, status: row.status }] : [];
    })
    .slice(0, AUTOPILOT_BRIEF_PREVIEW_ITEMS);

  return {
    id: brief.id,
    href: autopilotBriefPath(brief.id),
    headline: content.headline,
    summary: content.summary,
    sectionTitles: content.sections.map((section) => section.title),
    createdAt: brief.createdAt,
    items,
  };
}
