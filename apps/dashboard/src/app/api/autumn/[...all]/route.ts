import { autumnHandler } from "autumn-js/next";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const autumnSecretKey = process.env.AUTUMN_SECRET_KEY;
let hasWarnedAboutMissingAutumnKey = false;

const autumnRouteHandler = autumnHandler({
  identify: async (request) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!(session?.user && session?.session?.activeOrganizationId)) {
      return null;
    }

    return {
      customerId: session.session.activeOrganizationId,
      customerData: {
        name: session.user.name,
        email: session.user.email,
      },
    };
  },
});

const { GET: configuredGET, POST: configuredPOST } = autumnRouteHandler;

function warnAboutMissingAutumnKey(route: string) {
  if (hasWarnedAboutMissingAutumnKey) {
    return;
  }

  hasWarnedAboutMissingAutumnKey = true;
  console.warn(
    `[Autumn] AUTUMN_SECRET_KEY not configured - returning stub response for /api/autumn/${route}`
  );
}

function buildAutumnStubResponse(route: string) {
  switch (route) {
    case "getOrCreateCustomer":
      return NextResponse.json(null);
    case "listPlans":
      return NextResponse.json([]);
    case "aggregateEvents":
      return NextResponse.json({
        list: [],
        total: {},
      });
    case "listEvents":
      return NextResponse.json({
        list: [],
        hasMore: false,
      });
    default:
      return NextResponse.json(
        {
          error: "Autumn billing is not configured",
          code: "AUTUMN_NOT_CONFIGURED",
        },
        { status: 503 }
      );
  }
}

type AutumnRouteContext = {
  params: Promise<{ all?: string[] }>;
};

async function handleMissingAutumnKey(context: AutumnRouteContext) {
  const { all } = await context.params;
  const route = all?.join("/") ?? "";
  warnAboutMissingAutumnKey(route || "<root>");
  return buildAutumnStubResponse(route);
}

export async function GET(request: NextRequest, context: AutumnRouteContext) {
  if (!autumnSecretKey) {
    return handleMissingAutumnKey(context);
  }

  return configuredGET(request);
}

export async function POST(request: NextRequest, context: AutumnRouteContext) {
  if (!autumnSecretKey) {
    return handleMissingAutumnKey(context);
  }

  return configuredPOST(request);
}
