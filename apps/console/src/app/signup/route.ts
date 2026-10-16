import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );
  const url = await getSignUpUrl({
    returnTo: returnTo ?? "/dashboard",
    redirectUri: process.env.CONSOLE_WORKOS_REDIRECT_URI,
  });
  redirect(url);
}
