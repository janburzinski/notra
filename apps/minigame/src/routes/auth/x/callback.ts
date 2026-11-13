import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";

import { OAUTH_COOKIE } from "@/constants/server";
import { publicOrigin, xOAuthConfig } from "@/lib/server/config";
import { startSession } from "@/lib/server/session";
import { readSignedValue } from "@/lib/server/signed-cookie";
import { signInWithX } from "@/lib/server/x-oauth";
import { oauthCallbackSchema, oauthStateSchema } from "@/schemas/api";
import { withAuthResult } from "@/utils/return-path";

async function GET(request: Request) {
  const url = new URL(request.url);
  const pending = await readSignedValue(
    getCookie(OAUTH_COOKIE),
    oauthStateSchema
  );
  deleteCookie(OAUTH_COOKIE, { path: "/auth" });
  const returnTo = pending?.returnTo ?? "/";
  const back = (result: string) =>
    Response.redirect(
      new URL(withAuthResult(returnTo, result), url.origin),
      303
    );

  const query = oauthCallbackSchema.safeParse({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
  });
  if (!query.success) {
    return back(
      url.searchParams.get("error") === "access_denied" ? "denied" : "failed"
    );
  }
  const client = xOAuthConfig();
  if (!(client && pending) || pending.state !== query.data.state) {
    return back("failed");
  }
  const player = await signInWithX(
    client,
    query.data.code,
    pending.verifier,
    `${publicOrigin(request)}/auth/x/callback`
  ).catch(() => null);
  if (!player) {
    return back("failed");
  }
  // the profile is only stored with a score; until then it lives in the signed session cookie
  return (await startSession(player)) ? back("ok") : back("unavailable");
}

export const Route = createFileRoute("/auth/x/callback")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});
