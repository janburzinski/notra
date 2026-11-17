import { geoPromptScanRequestSchema } from "@notra/geo-core/schemas/geo-prompt-scan";

import { startGeoPromptScanForAgent } from "@/lib/geo/agent-prompt-scan";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Starts one tracked prompt's scan for Notra's agent in Slack, which runs in
 * its own deployment and can't hand work to the dashboard's workflows itself.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = geoPromptScanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { outcome, httpStatus } = await startGeoPromptScanForAgent(parsed.data);
  return outcome.status === "error"
    ? Response.json({ error: outcome.error }, { status: httpStatus })
    : Response.json(outcome, { status: httpStatus });
}
