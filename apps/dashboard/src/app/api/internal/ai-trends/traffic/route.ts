import { logError } from "@notra/ai/utils/server-log";
import {
  isTinybirdConfigured,
  queryGeoTrafficTrendsDaily,
  queryGeoTrafficTrendsProjects,
} from "@notra/analytics/tinybird/client";
import { aiTrendsTrafficRequestSchema } from "@notra/schemas/api/ai-trends-traffic";

import { realTrafficProjectIds } from "@/lib/analytics/real-traffic-projects";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Cross-organization AI traffic for the Notra admin console's AI Search
 * Trends page. Tinybird credentials live here, so the console asks this route
 * instead of reading Tinybird itself.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = aiTrendsTrafficRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!isTinybirdConfigured()) {
    return Response.json({ configured: false, daily: [], projects: [] });
  }

  const { from, baselineFrom, recentFrom, toExclusive } = parsed.data;
  try {
    const projectRows =
      (
        await queryGeoTrafficTrendsProjects({
          date_from: from,
          date_to: toExclusive,
          baseline_from: baselineFrom,
          recent_from: recentFrom,
        })
      )?.data ?? [];
    const projectIds = [...new Set(projectRows.map((row) => row.project_id))];
    const real = await realTrafficProjectIds(projectIds);
    const excluded = projectIds.filter((id) => !real.has(id));
    const daily =
      (
        await queryGeoTrafficTrendsDaily({
          date_from: from,
          date_to: toExclusive,
          excluded_project_ids: excluded.join(","),
        })
      )?.data ?? [];
    return Response.json({
      configured: true,
      daily,
      projects: projectRows.filter((row) => real.has(row.project_id)),
    });
  } catch (error) {
    logError("AI trends traffic query failed", error);
    return Response.json({ error: "AI traffic query failed" }, { status: 502 });
  }
}
