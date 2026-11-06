import { logError } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";

import { PUBLIC_DATA_CACHE_CONTROL } from "@/constants/public-data";
import { getPublicAiTrafficSnapshot } from "@/lib/public-data/ai-traffic";

/**
 * Today's anonymized AI traffic snapshot, read by the marketing site's /data
 * page. Public on purpose: it only carries aggregate shares, and it is built
 * at most once a day.
 */
export async function GET() {
  if (isDemoMode()) {
    return new Response(null, { status: 404 });
  }
  try {
    const snapshot = await getPublicAiTrafficSnapshot();
    if (!snapshot) {
      return Response.json(
        { error: "AI traffic data is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": PUBLIC_DATA_CACHE_CONTROL,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    logError("Public AI traffic snapshot failed", error);
    return Response.json(
      { error: "AI traffic data is unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
