import { FEATURES } from "@notra/ai/billing/features";
import type { ContentBillingReservation } from "@notra/ai/types/billing";
import { redis } from "@notra/ai/utils/redis";

import { GEO_ANSWER_LIMIT_NOTIFIED_TTL_SECONDS } from "@/constants/geo-answer-limit";
import { sendAiCreditsDepletedEmails } from "@/lib/workflows/shared/ai-credit-notifications";

export async function notifyGeoAnswerLimitReached(
  organizationId: string,
  reservation: ContentBillingReservation
): Promise<void> {
  if (
    reservation.allowed ||
    reservation.reason !== "quota_exhausted" ||
    reservation.featureId !== FEATURES.AI_ANSWERS ||
    !reservation.shouldNotify ||
    !redis
  ) {
    return;
  }
  const key = `geo:ai-answers-limit-notified:${organizationId}:${new Date().toISOString().slice(0, 7)}`;
  const claimed = await redis.set(key, "1", {
    nx: true,
    ex: GEO_ANSWER_LIMIT_NOTIFIED_TTL_SECONDS,
  });
  if (!claimed) {
    return;
  }
  try {
    await sendAiCreditsDepletedEmails({
      organizationId,
      automationName: "AI answer tracking",
      logPrefix: "GEO",
      limitLabel: "AI answers",
    });
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}
