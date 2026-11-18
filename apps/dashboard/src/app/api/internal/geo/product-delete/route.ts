import { geoProductDeleteRequestSchema } from "@notra/geo-core/schemas/geo-agent-products";

import { deleteGeoProductForAgent } from "@/lib/geo/agent-products";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/** Deletes a GEO product for Notra's agent in Slack; its prompts are re-filed. */
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
  const parsed = geoProductDeleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { outcome, httpStatus } = await deleteGeoProductForAgent(parsed.data);
  return httpStatus === 200
    ? Response.json(outcome)
    : Response.json(
        { error: "error" in outcome ? outcome.error : "Failed" },
        { status: httpStatus }
      );
}
