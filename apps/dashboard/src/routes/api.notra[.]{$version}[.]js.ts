import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";

export const Route = createFileRoute("/api/notra.{$version}.js")({
  server: {
    handlers: {
      ANY: async ({ request, params }) => {
        const handlers = await import("@/app/api/notra.[version].js/route");
        return dispatchRouteHandler(handlers, request, params);
      },
    },
  },
});
