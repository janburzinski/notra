import { db } from "@notra/db/drizzle";
import { organizations, users } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { isChatDeleted, loadChatHistory } from "@/lib/chat-history";
import {
  getChatShareByToken,
  isEmailInvited,
  isShareExpired,
  isUserOrganizationMember,
} from "@/lib/chat-shares";
import { getShareAccessCookieName } from "@/lib/share-cookies";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const share = await getChatShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isShareExpired(share)) {
    return NextResponse.json({ error: "Share link expired" }, { status: 410 });
  }
  if (await isChatDeleted(share.organizationId, share.chatId)) {
    return NextResponse.json(
      { error: "The chat has been deleted" },
      { status: 410 }
    );
  }

  const { user } = await getServerSession({ headers: request.headers });

  if (share.visibility === "private") {
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required", reason: "login" },
        { status: 401 }
      );
    }
    if (!isEmailInvited(share, user.email)) {
      return NextResponse.json(
        { error: "You are not invited to this chat", reason: "not_invited" },
        { status: 403 }
      );
    }
  } else if (share.visibility === "organization") {
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required", reason: "login" },
        { status: 401 }
      );
    }
    const isMember = await isUserOrganizationMember(
      user.id,
      share.organizationId
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "Organization members only", reason: "not_member" },
        { status: 403 }
      );
    }
  } else if (share.visibility === "password") {
    const cookie = request.cookies.get(getShareAccessCookieName(token));
    if (cookie?.value !== "1") {
      return NextResponse.json(
        { error: "Password required", reason: "password" },
        { status: 401 }
      );
    }
  }

  const [messages, owner, organization] = await Promise.all([
    loadChatHistory(share.organizationId, share.chatId),
    db.query.users.findFirst({
      where: eq(users.id, share.ownerUserId),
      columns: { id: true, name: true, image: true },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, share.organizationId),
      columns: { id: true, name: true, slug: true, logo: true },
    }),
  ]);

  return NextResponse.json({
    chat: {
      chatId: share.chatId,
      messages,
    },
    share: {
      visibility: share.visibility,
      allowFork: share.allowFork,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    },
    owner: owner ?? null,
    organization: organization ?? null,
  });
}
