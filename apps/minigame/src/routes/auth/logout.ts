import { createFileRoute } from "@tanstack/react-router";

import { endSession } from "@/lib/server/session";

/** POST only: the session cookie is SameSite=Lax, so another site can't sign you out. */
function POST(request: Request) {
  endSession();
  return Response.redirect(new URL("/", request.url), 303);
}

export const Route = createFileRoute("/auth/logout")({
  server: { handlers: { POST: ({ request }) => POST(request) } },
});
