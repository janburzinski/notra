import { geoPromptFindRequestSchema } from "@notra/geo-core/schemas/geo-prompt-scan";

import { findGeoPromptsForAgent } from "@/lib/geo/agent-prompt-scan";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Lists the tracked prompts a query points at for Notra's agent in Slack, so
 * it can name the exact prompt before asking to scan it.
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
  const parsed = geoPromptFindRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { outcome, httpStatus } = await findGeoPromptsForAgent(parsed.data);
  return "status" in outcome
    ? Response.json({ error: outcome.error }, { status: httpStatus })
    : Response.json(outcome, { status: httpStatus });
}
