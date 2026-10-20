import { POSTHOG_EVENTS } from "@notra/posthog/events";

import { flushTrackEvent } from "@/lib/analytics/posthog-client";
import type { AttachPlanParams, AttachPlanResult } from "@/types/billing/plan";
import { zdrAddonPlanId } from "@/utils/billing-plans";
import { getDatabuddyPaymentMetadata } from "@/utils/databuddy";

export async function attachPlanWithAddons({
  attach,
  multiAttach,
  planId,
  includeZdr,
  successUrl,
}: AttachPlanParams): Promise<AttachPlanResult> {
  const zdrPlanId = includeZdr ? zdrAddonPlanId(planId) : null;
  const metadata = getDatabuddyPaymentMetadata();

  if (zdrPlanId) {
    const result = await multiAttach({
      plans: [{ planId }, { planId: zdrPlanId }],
      checkoutSessionParams: { metadata, subscription_data: { metadata } },
      redirectMode: "if_required",
      successUrl,
    });
    if (result.paymentUrl) {
      await flushTrackEvent(POSTHOG_EVENTS.CHECKOUT_REDIRECTED, {
        plan_id: planId,
        zdr: true,
      });
    }
    return { paymentUrl: result.paymentUrl ?? null };
  }

  const result = await attach({
    planId,
    metadata,
    redirectMode: "if_required",
    successUrl,
  });
  if (result.paymentUrl) {
    await flushTrackEvent(POSTHOG_EVENTS.CHECKOUT_REDIRECTED, {
      plan_id: planId,
      zdr: false,
    });
  }
  return { paymentUrl: result.paymentUrl ?? null };
}
