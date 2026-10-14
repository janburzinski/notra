import { runScheduledPublicationSweep } from "@/lib/content/scheduled-publication-sweep";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runScheduledPublicationSweep();
  if (result.claimed > 0) {
    console.info("[ScheduledPublication] Sweep", result);
  }
  return Response.json(result);
}
