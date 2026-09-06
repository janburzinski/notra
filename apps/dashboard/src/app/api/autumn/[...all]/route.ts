import { autumnHandler } from "autumn-js/next";
import { allowUnmeteredAiInDevelopment } from "@notra/ai/billing/autumn";

import { getAuthSession } from "@/lib/auth/server";
import { resolveBillingOrganizationId } from "@/lib/billing/resolve-billing-organization";
import { createDevelopmentAutumnCustomer } from "@/utils/development-autumn-customer";

type RouteHandler = (request: Request) => Response | Promise<Response>;

const handlers: { GET: RouteHandler; POST: RouteHandler } | null = allowUnmeteredAiInDevelopment
  ? null
  : autumnHandler({
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

const developmentHandler: RouteHandler = (request) => {
  const route = new URL(request.url).pathname.split("/").at(-1);

  if (route === "getOrCreateCustomer") {
    return Response.json(createDevelopmentAutumnCustomer());
  }

  return Response.json(
    { error: "Billing operations are unavailable without an Autumn key" },
    { status: 503 },
  );
};

export const GET = handlers?.GET ?? developmentHandler;
export const POST = handlers?.POST ?? developmentHandler;
