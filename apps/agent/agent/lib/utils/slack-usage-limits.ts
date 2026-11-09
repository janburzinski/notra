import { checkChatBilling } from "@notra/ai/billing/chat-billing";
import { consumeChatGenerationRateLimit } from "@notra/ai/utils/chat-generation-rate-limit";
import { logError } from "@notra/ai/utils/server-log";

import {
  SLACK_RATE_LIMITED_MESSAGE,
  SLACK_USAGE_LIMIT_REACHED_MESSAGE,
} from "../constants/slack";
import type { SlackUsageCheck } from "../types/slack";

/**
 * Runs the dashboard chat's rate limit and credit check before a Slack turn.
 * Slack users have no Notra user id, so the per-user window is keyed by the
 * Slack identity while the organization window is shared with the dashboard.
 * Omit `slackUser` for turns already rate limited elsewhere. A failing check
 * is logged and lets the turn through; usage is still metered afterwards.
 */
export async function checkSlackUsageLimits(
  organizationId: string,
  slackUser?: { teamId: string; userId: string }
): Promise<SlackUsageCheck> {
  const [rateLimit, billing] = await Promise.all([
    slackUser
      ? consumeChatGenerationRateLimit(
          organizationId,
          `slack:${slackUser.teamId}:${slackUser.userId}`
        ).catch((error: unknown) => {
          logError("[Slack] Rate limit check failed", error, {
            organizationId,
          });
          return null;
        })
      : null,
    checkChatBilling(organizationId).catch((error: unknown) => {
      logError("[Slack] Credit check failed", error, { organizationId });
      return null;
    }),
  ]);

  if (rateLimit && !rateLimit.success) {
    return { allowed: false, message: SLACK_RATE_LIMITED_MESSAGE };
  }
  if (billing && !billing.allowed) {
    return { allowed: false, message: SLACK_USAGE_LIMIT_REACHED_MESSAGE };
  }
  return {
    allowed: true,
    attributes: billing
      ? {
          useMarkup: String(billing.useMarkup),
          chargeAiCredits: String(billing.chargeAiCredits),
        }
      : {},
  };
}
