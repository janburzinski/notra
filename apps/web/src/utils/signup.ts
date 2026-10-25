import { track } from "@databuddy/sdk/react";

import { AUTH_SIGNUP_URL } from "@/constants/auth";
import type { BillingPeriod } from "@/types/landing/pricing";
import { withAppTracking } from "@/utils/app-tracking";
import {
  DATABUDDY_SIGNUP_STARTED_EVENT,
  serializeSignupAttribution,
} from "@/utils/databuddy";

export function trackedSignupHref(
  source: string,
  href = AUTH_SIGNUP_URL
): string {
  return serializeSignupAttribution(new URL(href, AUTH_SIGNUP_URL), {
    source,
  });
}

export function startSignup(source: string, href = AUTH_SIGNUP_URL): void {
  const destination = withAppTracking(trackedSignupHref(source, href));
  track(DATABUDDY_SIGNUP_STARTED_EVENT, {
    destination,
    source,
  });
  window.location.assign(destination);
}

export function pricingPlanHref(
  href: string,
  planId: string,
  billingPeriod: BillingPeriod
): string {
  const url = new URL(href, AUTH_SIGNUP_URL);
  url.searchParams.set(
    "plan",
    billingPeriod === "yearly" ? `${planId}_annual` : planId
  );
  return url.toString();
}
