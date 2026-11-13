import {
  getLinearOAuthCredentials,
  refreshDueLinearAccessTokens,
} from "@notra/ai/integrations/linear-oauth";
import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode() || !getLinearOAuthCredentials()) {
    return new Response(null, { status: 204 });
  }

  const summary = await refreshDueLinearAccessTokens();
  return Response.json(summary, { status: summary.failed > 0 ? 500 : 200 });
}
