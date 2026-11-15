import { db } from "@notra/db/drizzle";
import { autopilotSettings } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { canManageAutopilot } from "@/utils/autopilot-permissions";

/**
 * What a viewer may do with Autopilot items, wherever they are listed: the
 * daily brief, or an artifact's Autopilot block.
 */
export async function loadAutopilotActionContext(
  organizationId: string,
  role: string
) {
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { enabled: true, repositoryBranch: true, timezone: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  return {
    canManage: canManageAutopilot(role),
    // Writing an idea needs Autopilot switched on.
    canWrite: settings?.enabled ?? false,
    branch: settings?.repositoryBranch ?? null,
    // Dates in the workspace's time, not the viewer's UTC default.
    timeZone: settings?.timezone ?? "UTC",
  };
}
