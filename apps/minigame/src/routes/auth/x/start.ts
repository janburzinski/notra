import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";

import { OAUTH_COOKIE, OAUTH_MAX_AGE_S } from "@/constants/server";
import { isProduction, publicOrigin, xOAuthConfig } from "@/lib/server/config";
import { signValue } from "@/lib/server/signed-cookie";
import { authorizeUrl, pkceChallenge } from "@/lib/server/x-oauth";
import { randomToken } from "@/utils/base64url";
import { safeReturnPath, withAuthResult } from "@/utils/return-path";

async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  const client = xOAuthConfig();
  const state = randomToken(24);
  const verifier = randomToken(48);
  const cookie = client
    ? await signValue({
        state,
        verifier,
        returnTo,
        exp: Date.now() + OAUTH_MAX_AGE_S * 1000,
      })
    : null;
  if (!(client && cookie)) {
    return Response.redirect(
      new URL(withAuthResult(returnTo, "unavailable"), url.origin),
      303
    );
  }
  setCookie(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/auth",
    maxAge: OAUTH_MAX_AGE_S,
  });
  return Response.redirect(
    authorizeUrl(
      client,
      `${publicOrigin(request)}/auth/x/callback`,
      state,
      await pkceChallenge(verifier)
    ),
    303
  );
}

export const Route = createFileRoute("/auth/x/start")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});
