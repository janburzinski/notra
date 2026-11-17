import type { Plan } from "@notra/ai/types/router";

import { autumn, AUTUMN_READ_TIMEOUT_MS } from "./autumn";
import { PAID_OR_LEGACY_PLAN_IDS } from "./features";

/**
 * Resolve an organization's billing plan for routing purposes.
 *
 * Mirrors the access check in the dashboard (`assertActiveSubscription`):
 * an active, non-add-on subscription on a paid or legacy plan counts as
 * "paid". Without a configured Autumn client every organization is "free".
 */
export async function resolveOrganizationPlan(
  organizationId: string
): Promise<Plan> {
  if (!autumn) {
    return "free";
  }

  const customer = await autumn.customers.getOrCreate(
    { customerId: organizationId },
    { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
  );

  const hasPaidPlan = customer.subscriptions.some(
    (subscription) =>
      !subscription.addOn &&
      subscription.status === "active" &&
      PAID_OR_LEGACY_PLAN_IDS.has(subscription.planId)
  );

  return hasPaidPlan ? "paid" : "free";
}

/**
 * Each organization's active paid or legacy plan id, or `null` without a
 * configured Autumn client.
 */
export async function listPaidOrganizationPlans(): Promise<Map<
  string,
  string
> | null> {
  if (!autumn) {
    return null;
  }

  const plans = [...PAID_OR_LEGACY_PLAN_IDS].map((id) => ({ id }));
  const paid = new Map<string, string>();
  let startCursor: string | undefined;
  do {
    const page = await autumn.customers.list(
      { plans, subscriptionStatus: "active", limit: 1000, startCursor },
      { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
    );
    for (const customer of page.list) {
      const subscription = customer.subscriptions.find(
        ({ addOn, status, planId }) =>
          !addOn && status === "active" && PAID_OR_LEGACY_PLAN_IDS.has(planId)
      );
      if (customer.id && subscription) {
        paid.set(customer.id, subscription.planId);
      }
    }
    startCursor = page.nextCursor ?? undefined;
  } while (startCursor);

  return paid;
}
