import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";
import { requestLogMiddleware } from "@/middleware/request-log";

export const Route = createFileRoute("/api/internal/geo/answer-limit")({
  server: {
    middleware: [requestLogMiddleware],
    handlers: {
      ANY: async (ctx) => {
        const { log } = ctx.context;
        log.set({ routeId: "/api/internal/geo/answer-limit" });
        const handlers =
          await import("@/app/api/internal/geo/answer-limit/route");
        return dispatchRouteHandler(handlers, ctx.request, ctx.params);
      },
    },
  },
});
