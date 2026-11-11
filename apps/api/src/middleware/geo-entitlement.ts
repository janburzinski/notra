import { shouldBypassAutumnInDevelopment } from "@notra/ai/utils/autumn-development";
import { Effect } from "effect";
import type { Context, Next } from "hono";

import { API_PAYWALL_FEATURES } from "../constants/analytics";
import { RESTRICTED_BILLING_METHODS } from "../constants/billing";
import { GEO_PLAN_REQUIRED_MESSAGE } from "../constants/geo";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import { getBillingLayer } from "../lib/billing";
import { checkGeoEntitlement } from "../programs/geo-entitlement";
import { trackApiPaywalled } from "../utils/analytics";
import { getOrganizationId } from "../utils/auth";
import { logError } from "../utils/logging";

export function geoEntitlementMiddleware() {
  return async (c: Context, next: Next) => {
    if (!RESTRICTED_BILLING_METHODS.has(c.req.method)) {
      return next();
    }

    const secretKey = c.env.AUTUMN_SECRET_KEY as string | undefined;
    if (!secretKey) {
      if (shouldBypassAutumnInDevelopment(process.env.NODE_ENV, secretKey)) {
        return next();
      }

      logError(
        "AUTUMN_SECRET_KEY is not configured — rejecting GEO request",
        new Error("Missing AUTUMN_SECRET_KEY")
      );
      trackApiPaywalled(c, {
        feature: API_PAYWALL_FEATURES.AI_ANSWERS,
        status: 503,
      });
      return c.json({ error: "Billing service unavailable" }, 503);
    }

    const orgId = getOrganizationId(c);
    if (!orgId) {
      return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
    }

    const entitlement = await Effect.runPromise(
      Effect.result(
        checkGeoEntitlement({ organizationId: orgId, secretKey }).pipe(
          Effect.provide(getBillingLayer(secretKey))
        )
      )
    );
    if (entitlement._tag === "Failure") {
      logError(
        "Failed to verify GEO plan entitlement",
        entitlement.failure.cause
      );
      trackApiPaywalled(c, {
        feature: API_PAYWALL_FEATURES.AI_ANSWERS,
        status: 503,
      });
      return c.json({ error: "Billing service unavailable" }, 503);
    }

    if (!entitlement.success) {
      trackApiPaywalled(c, {
        feature: API_PAYWALL_FEATURES.AI_ANSWERS,
        status: 402,
      });
      return c.json({ error: GEO_PLAN_REQUIRED_MESSAGE }, 402);
    }

    return next();
  };
}
