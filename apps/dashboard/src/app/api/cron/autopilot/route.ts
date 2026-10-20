import { isAuthorizedCron } from "@/lib/auth/cron";
import { runDueAutopilots } from "@/lib/autopilot/schedule";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runDueAutopilots();
  return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
}
