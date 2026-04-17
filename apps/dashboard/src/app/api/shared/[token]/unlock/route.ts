import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getChatShareByToken, isShareExpired } from "@/lib/chat-shares";
import {
  getShareAccessCookieName,
  SHARE_ACCESS_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/share-cookies";
import { verifySharePassword } from "@/lib/share-password";
import { unlockShareSchema } from "@/schemas/chat-share";
import { getClientIp, ratelimit } from "@/utils/ratelimit";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const ip = getClientIp(request);
  const { success: allowed } = await ratelimit.shareUnlock.limit(
    `${ip}:${token}`
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts, try again later" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = unlockShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const share = await getChatShareByToken(token);
  if (!share || share.visibility !== "password" || !share.passwordHash) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isShareExpired(share)) {
    return NextResponse.json({ error: "Share link expired" }, { status: 410 });
  }

  const ok = await verifySharePassword(
    parsed.data.password,
    share.passwordHash
  );
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getShareAccessCookieName(token),
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SHARE_ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
