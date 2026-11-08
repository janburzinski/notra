import { checkContentBilling } from "@notra/ai/billing/content-billing";
import { FEATURES } from "@notra/ai/billing/features";
import { internalGeoAnswerLimitInputSchema } from "@notra/schemas/api/internal-geo";

import { notifyGeoAnswerLimitReached } from "@/lib/geo/answer-limit-notification";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = internalGeoAnswerLimitInputSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { organizationId } = parsed.data;
  const gate = await checkContentBilling({
    organizationId,
    outputType: null,
    quotaFeatureId: FEATURES.AI_ANSWERS,
  });
  await notifyGeoAnswerLimitReached(organizationId, gate);
  return Response.json({ ok: true });
}
