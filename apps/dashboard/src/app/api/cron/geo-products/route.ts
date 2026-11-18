import { flushGeoLog } from "@notra/ai/evlog";
import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { runDueGeoProductSiteChecks } from "@/lib/geo/product-site-checks";

/** Hourly: checks this week's due project websites for new products. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }

  try {
    const result = await runDueGeoProductSiteChecks();
    return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
  } finally {
    await flushGeoLog();
  }
}
