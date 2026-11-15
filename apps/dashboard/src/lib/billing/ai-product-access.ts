import {
  allowUnmeteredAiInDevelopment,
  autumn,
  AUTUMN_READ_TIMEOUT_MS,
} from "@notra/ai/billing/autumn";
import { FEATURES, PAID_OR_LEGACY_PLAN_IDS } from "@notra/ai/billing/features";
import { ORPCError } from "@orpc/server";
import { Cache, Duration, Effect, Exit } from "effect";

import { internalServerError } from "@/lib/orpc/utils/errors";

// Kept apart from subscription.ts, whose translated errors read the request
// locale: durable workflow steps import this and run without a request.

const GRANTED_ACCESS_TTL = Duration.minutes(1);
const GRANTED_ACCESS_CACHE_CAPACITY = 10_000;

async function hasAiCreditsBalance(organizationId: string): Promise<boolean> {
  if (!autumn) {
    return false;
  }

  const data = await autumn.check(
    {
      customerId: organizationId,
      featureId: FEATURES.AI_CREDITS,
      requiredBalance: 1,
    },
    { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
  );

  return data.allowed === true;
}

async function lookupAiProductAccess(organizationId: string) {
  if (!autumn) {
    return { hasAccess: true, activePlanId: null };
  }

  const customer = await autumn.customers.getOrCreate({
    customerId: organizationId,
  });

  const activePlanId =
    customer.subscriptions.find(
      (subscription) => !subscription.addOn && subscription.status === "active"
    )?.planId ?? null;

  const hasPaidPlan = customer.subscriptions.some(
    (subscription) =>
      !subscription.addOn &&
      subscription.status === "active" &&
      PAID_OR_LEGACY_PLAN_IDS.has(subscription.planId)
  );

  return {
    hasAccess: hasPaidPlan || (await hasAiCreditsBalance(organizationId)),
    activePlanId,
  };
}

const aiProductAccessCache = Effect.runSync(
  Cache.makeWith(
    (organizationId: string) =>
      Effect.tryPromise({
        try: () => lookupAiProductAccess(organizationId),
        catch: (cause) => cause,
      }),
    {
      capacity: GRANTED_ACCESS_CACHE_CAPACITY,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value.hasAccess
          ? GRANTED_ACCESS_TTL
          : Duration.zero,
    }
  )
);

export async function resolveAiProductAccess(organizationId: string) {
  if (allowUnmeteredAiInDevelopment) {
    return { hasAccess: true, activePlanId: null };
  }

  if (!autumn) {
    if (process.env.NODE_ENV === "production") {
      throw internalServerError("Billing is not configured");
    }
    return { hasAccess: true, activePlanId: null };
  }

  try {
    return await Effect.runPromise(
      Cache.get(aiProductAccessCache, organizationId)
    );
  } catch (error) {
    if (error instanceof ORPCError) {
      throw error;
    }
    throw internalServerError("Failed to verify subscription status");
  }
}
