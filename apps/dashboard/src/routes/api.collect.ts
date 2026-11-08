import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";

export const Route = createFileRoute("/api/collect")({
  server: {
    handlers: {
      ANY: async ({ request, params }) => {
        const handlers = await import("@/app/api/collect/route");
        return dispatchRouteHandler(handlers, request, params);
      },
    },
  },
});
