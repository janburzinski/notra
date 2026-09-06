import { FEATURES } from "@notra/ai/billing/features";

const DEVELOPMENT_BALANCE = Number.MAX_SAFE_INTEGER;

export function createDevelopmentAutumnCustomer() {
  return {
    id: "development",
    name: "Local development",
    email: null,
    createdAt: 0,
    fingerprint: null,
    stripeId: null,
    env: "sandbox",
    metadata: {},
    sendEmailReceipts: false,
    billingControls: {},
    subscriptions: [],
    purchases: [],
    licenses: [],
    balances: Object.fromEntries(
      Object.values(FEATURES).map((featureId) => [
        featureId,
        {
          featureId,
          feature: {
            id: featureId,
            name: featureId,
            type: "metered",
            consumable: true,
            archived: false,
          },
          granted: DEVELOPMENT_BALANCE,
          remaining: DEVELOPMENT_BALANCE,
          usage: 0,
          unlimited: true,
          overageAllowed: false,
          maxPurchase: null,
          nextResetAt: null,
        },
      ]),
    ),
    flags: {},
  };
}
