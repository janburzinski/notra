import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { ORPCError } from "@orpc/server";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { assertRateLimit } from "@/lib/orpc/utils/rate-limit";

export async function GET(request: Request) {
  const ip =
    process.env.VERCEL === "1"
      ? (request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
      : "unknown";
  try {
    await assertRateLimit({
      key: `sign-in:${ip}`,
      limit: 10,
      windowSeconds: 60,
    });
  } catch (error) {
    if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS") {
      return new Response(
        "Too many sign-in attempts. Please try again shortly.",
        {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        }
      );
    }
    return new Response("Sign-in is temporarily unavailable.", { status: 503 });
  }
  const url = await getSignInUrl({
    returnTo:
      sanitizeReturnTo(new URL(request.url).searchParams.get("returnTo")) ??
      "/dashboard",
    redirectUri: process.env.CONSOLE_WORKOS_REDIRECT_URI,
  });
  redirect(url);
}
