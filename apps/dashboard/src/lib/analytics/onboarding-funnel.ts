import { track } from "@databuddy/sdk";

import { ONBOARDING_FLOW_VARIANTS } from "@/constants/analytics-events";

let onboardingVariant: string = ONBOARDING_FLOW_VARIANTS.CONTROL;

export function setOnboardingVariant(variant: string): void {
  onboardingVariant = variant;
}

export function trackOnboardingFunnelEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  track(event, { ...properties, onboarding_variant: onboardingVariant });
}
