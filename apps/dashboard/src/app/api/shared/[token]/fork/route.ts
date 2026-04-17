import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  generateChatId,
  loadChatHistory,
  replaceChatHistory,
} from "@/lib/chat-history";
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const share = await getChatShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isShareExpired(share)) {
    return NextResponse.json({ error: "Share link expired" }, { status: 410 });
  }
  if (!share.allowFork) {
    return NextResponse.json(
      { error: "Forking is disabled for this chat" },
      { status: 403 }
    );
  }

  const { session, user } = await getServerSession({
    headers: request.headers,
  });
  if (!(user && session)) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (share.visibility === "private" && !isEmailInvited(share, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (share.visibility === "organization") {
    const isMember = await isUserOrganizationMember(
      user.id,
      share.organizationId
    );
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (share.visibility === "password") {
    const cookie = request.cookies.get(getShareAccessCookieName(token));
    if (cookie?.value !== "1") {
      return NextResponse.json({ error: "Password required" }, { status: 401 });
    }
  }

  const targetOrganizationId = session.activeOrganizationId;
  if (!targetOrganizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 }
    );
  }
  const isMemberOfTarget = await isUserOrganizationMember(
    user.id,
    targetOrganizationId
  );
  if (!isMemberOfTarget) {
    return NextResponse.json(
      { error: "Not a member of target organization" },
      { status: 403 }
    );
  }

  const [messages, targetOrg] = await Promise.all([
    loadChatHistory(share.organizationId, share.chatId),
    db.query.organizations.findFirst({
      where: eq(organizations.id, targetOrganizationId),
      columns: { id: true, slug: true },
    }),
  ]);
  if (!targetOrg) {
    return NextResponse.json(
      { error: "Target organization not found" },
      { status: 404 }
    );
  }

  const newChatId = generateChatId();
  await replaceChatHistory(targetOrganizationId, newChatId, messages);

  return NextResponse.json({
    chatId: newChatId,
    organizationSlug: targetOrg.slug,
    redirectTo: `/${targetOrg.slug}/chat/${newChatId}`,
  });
}
