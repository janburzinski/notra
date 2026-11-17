import {
  createSlackConnectChannelWithInvite,
  hasSlackConnectChannelForDomain,
  hasSlackConnectConfigured,
} from "@notra/ai/integrations/slack";
import { logError } from "@notra/ai/utils/server-log";
import { buildExternalChannelName } from "@notra/ai/utils/slack";
import { isFreeEmail } from "free-email-domains-list";

import { isEduEmail } from "@/lib/onboarding/edu-email";
import type {
  OnboardingSlackInviteInput,
  OnboardingSlackInviteResult,
} from "@/types/onboarding";

export async function sendOnboardingSlackInvite({
  email,
}: OnboardingSlackInviteInput): Promise<OnboardingSlackInviteResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split("@").at(-1);
  if (
    !domain ||
    !hasSlackConnectConfigured() ||
    isFreeEmail(normalizedEmail) ||
    isEduEmail(normalizedEmail)
  ) {
    return { invited: false };
  }

  try {
    if (await hasSlackConnectChannelForDomain(domain)) {
      return { invited: false };
    }
    const result = await createSlackConnectChannelWithInvite({
      channelName: buildExternalChannelName(domain),
      domain,
      email: normalizedEmail,
      externalLimited: false,
    });
    return { channelId: result.channelId, invited: true };
  } catch (error) {
    logError("[Onboarding] Slack Connect invite failed", error, { domain });
    return { invited: false };
  }
}
