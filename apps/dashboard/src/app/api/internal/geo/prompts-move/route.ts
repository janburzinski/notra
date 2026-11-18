import { geoPromptsMoveRequestSchema } from "@notra/geo-core/schemas/geo-agent-products";

import { moveGeoPromptsForAgent } from "@/lib/geo/agent-products";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/** Moves tracked prompts into a product, or out of one, for Notra's agent in Slack. */
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
  const parsed = geoPromptsMoveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { outcome, httpStatus } = await moveGeoPromptsForAgent(parsed.data);
  return httpStatus === 200
    ? Response.json(outcome)
    : Response.json(
        { error: "error" in outcome ? outcome.error : "Failed" },
        { status: httpStatus }
      );
}
