import { autumn } from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { autumnHandler } from "autumn-js/next";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/server";
import { resolveBillingOrganizationId } from "@/lib/billing/resolve-billing-organization";

type RouteHandler = (request: Request) => Response | Promise<Response>;

const handlers: { GET: RouteHandler; POST: RouteHandler } = autumnHandler({
  identify: async (request) => {
    const session = await getAuthSession();

    if (!session?.user) {
      return null;
    }

    const customerId = await resolveBillingOrganizationId(request, session);

    if (!customerId) {
      return null;
    }

    return {
      customerId,
      customerData: {
        name: session.user.name,
        email: session.user.email,
      },
    };
  },
});

/**
 * Development without an Autumn secret key runs unmetered server-side (see
 * `allowUnmeteredAiInDevelopment`), so the client-side Autumn hooks get stubs
 * that answer "allowed" for every feature instead of the handler's 500
 * "no_secret_key" error. Production without a key still fails loudly.
 */
const isUnmeteredDevelopment =
  process.env.NODE_ENV === "development" && autumn === null;

const DEV_BALANCE = 999_999;

const devStubs: Record<string, unknown> = {
  getOrCreateCustomer: {
    id: null,
    flags: Object.fromEntries(
      Object.values(FEATURES).map((featureId) => [featureId, true])
    ),
    balances: {
      [FEATURES.AI_CREDITS]: {
        remaining: DEV_BALANCE,
        granted: DEV_BALANCE,
        feature: { id: FEATURES.AI_CREDITS, name: "AI Credits" },
      },
      [FEATURES.AI_ANSWERS]: {
        remaining: DEV_BALANCE,
        granted: DEV_BALANCE,
        feature: { id: FEATURES.AI_ANSWERS, name: "AI Answers" },
      },
    },
    subscriptions: [],
    invoices: [],
  },
  listPlans: { list: [] },
  listEvents: { list: [] },
  aggregateEvents: { list: [], total: {} },
  getEntity: null,
};

function withUnmeteredDevelopmentStubs(handler: RouteHandler): RouteHandler {
  return (request) => {
    if (!isUnmeteredDevelopment) {
      return handler(request);
    }

    const routeName = new URL(request.url).pathname.split("/").pop();

    if (routeName !== undefined && routeName in devStubs) {
      return NextResponse.json(devStubs[routeName]);
    }

    return handler(request);
  };
}

export const GET = withUnmeteredDevelopmentStubs(handlers.GET);
export const POST = withUnmeteredDevelopmentStubs(handlers.POST);
