import { autumnHandler } from "autumn-js/fetch";

import { getAuthIdentity } from "@/lib/auth/server";
import { prepareAutumnRequest } from "@/lib/billing/autumn-request";
import { resolveBillingOrganizationId } from "@/lib/billing/resolve-billing-organization";
import { createDevelopmentAutumnHandler } from "@/utils/development-autumn";

type RouteHandler = (request: Request) => Response | Promise<Response>;

async function resolveCustomerId(request: Request) {
  const identity = await getAuthIdentity();
  if (!identity?.user) {
    return null;
  }
  return resolveBillingOrganizationId(request, identity);
}

const developmentHandler = createDevelopmentAutumnHandler(
  process.env.NODE_ENV,
  process.env.AUTUMN_SECRET_KEY,
  resolveCustomerId
);

const autumnRouteHandler = autumnHandler({
  identify: async (request) => {
    const identity = await getAuthIdentity();

    if (!identity?.user) {
      return null;
    }

    const customerId = await resolveBillingOrganizationId(request, identity);

    if (!customerId) {
      return null;
    }

    return {
      customerId,
      customerData: {
        name: identity.user.name,
        email: identity.user.email,
      },
    };
  },
});

const handler: RouteHandler =
  developmentHandler ??
  (async (request) => {
    const prepared = await prepareAutumnRequest(request, () =>
      resolveCustomerId(request)
    );
    return prepared instanceof Response
      ? prepared
      : autumnRouteHandler(prepared);
  });

export const GET = handler;
export const POST = handler;
