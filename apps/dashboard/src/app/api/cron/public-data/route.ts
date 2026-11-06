import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { publishPublicAiTrafficSnapshot } from "@/lib/public-data/ai-traffic";

/** Publishes the day's public AI traffic snapshot once yesterday is complete. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  const snapshot = await publishPublicAiTrafficSnapshot();
  return Response.json({
    published: snapshot !== null,
    day: snapshot?.day ?? null,
    available: snapshot?.available ?? false,
  });
}
