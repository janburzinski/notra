import { db } from "@notra/db/drizzle";
import { autopilotSettings } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { purgeExpiredAutopilotTraceDetails } from "@/lib/autopilot/log";
import { startAutopilot } from "@/lib/autopilot/start";
import { isAutopilotDue } from "@/utils/autopilot-schedule";

export async function runDueAutopilots() {
  const now = new Date();
  await purgeExpiredAutopilotTraceDetails(now);
  const rows = await db.query.autopilotSettings.findMany({
    where: eq(autopilotSettings.enabled, true),
  });
  let started = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (!isAutopilotDue(row, now)) {
        continue;
      }
      if (!(await isAutopilotEnabledForOrganization(row.organizationId))) {
        continue;
      }
      const claim = await startAutopilot(row.organizationId, "cron");
      if (!claim.alreadyRunning) {
        started += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { checked: rows.length, started, failed };
}
