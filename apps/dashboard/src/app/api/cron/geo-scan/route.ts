import { flushGeoLog } from "@notra/ai/evlog";
import { runGeoScanCronSweep } from "@notra/geo-core/geo/scan-schedule";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }

  try {
    const result = await Effect.runPromise(
      runGeoScanCronSweep().pipe(Effect.provide(geoCoreDashboardLayer))
    );
    return Response.json(result);
  } finally {
    await flushGeoLog();
  }
}
