import { createFileRoute } from "@tanstack/react-router";

import { devLoginEnabled } from "@/lib/server/config";
import { startSession } from "@/lib/server/session";
import { safeReturnPath, withAuthResult } from "@/utils/return-path";

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const COMPANY = /^[A-Za-z0-9 ]{1,30}$/;

/**
 * Local stand-in for X sign-in, to play as another handle without an X app: /auth/dev?handle=ace.
 * Add &company=Acme to wear an affiliation badge.
 * Only on loopback in a non-production build.
 */
async function GET(request: Request) {
  if (!devLoginEnabled(request)) {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") ?? "devpilot";
  if (!HANDLE.test(handle)) {
    return new Response("Bad handle", { status: 400 });
  }
  const companyName = url.searchParams.get("company");
  if (companyName !== null && !COMPANY.test(companyName)) {
    return new Response("Bad company", { status: 400 });
  }
  const company = companyName
    ? {
        id: `dev-co-${companyName.toLowerCase().replaceAll(" ", "-")}`,
        name: companyName,
        badge: null,
        url: null,
      }
    : null;
  const player = {
    id: `dev-${handle}`,
    handle,
    name: handle,
    avatar: null,
    company,
  };
  await startSession(player);
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  return Response.redirect(
    new URL(withAuthResult(returnTo, "ok"), url.origin),
    303
  );
}

export const Route = createFileRoute("/auth/dev")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});
