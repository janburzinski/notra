import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAiChatExperimentEnabled } from "@/lib/ai-chat-experiment";
import { withOrganizationAuth } from "@/lib/auth/organization";
import { isChatDeleted } from "@/lib/chat-history";
import {
  buildShareUrl,
  type ChatShareWithInvitees,
  deleteChatShare,
  getChatShareForOwner,
  upsertChatShare,
} from "@/lib/chat-shares";
import { updateChatShareSchema } from "@/schemas/chat-share";

interface RouteContext {
  params: Promise<{ organizationId: string; chatId: string }>;
}

function serializeShare(
  request: NextRequest,
  share: ChatShareWithInvitees | null
) {
  if (!share) {
    return {
      visibility: "private" as const,
      shareUrl: null,
      hasPassword: false,
      allowFork: false,
      expiresAt: null,
      invitees: [] as { email: string; userId: string | null }[],
    };
  }
  const origin = request.nextUrl.origin;
  return {
    visibility: share.visibility,
    shareUrl: share.shareToken ? buildShareUrl(origin, share.shareToken) : null,
    hasPassword: Boolean(share.passwordHash),
    allowFork: share.allowFork,
    expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    invitees: share.invitees.map((invitee) => ({
      email: invitee.email,
      userId: invitee.userId,
    })),
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { organizationId, chatId } = await params;
  const auth = await withOrganizationAuth(request, organizationId);
  if (!auth.success) {
    return auth.response;
  }

  const aiChatEnabled = await isAiChatExperimentEnabled({
    userId: auth.context.user.id,
    email: auth.context.user.email,
    organizationId,
  });
  if (!aiChatEnabled) {
    return NextResponse.json(
      { error: "AI chat is not enabled for this organization" },
      { status: 403 }
    );
  }

  if (await isChatDeleted(organizationId, chatId)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const share = await getChatShareForOwner(organizationId, chatId);
  return NextResponse.json({ share: serializeShare(request, share) });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { organizationId, chatId } = await params;
  const auth = await withOrganizationAuth(request, organizationId);
  if (!auth.success) {
    return auth.response;
  }

  const aiChatEnabled = await isAiChatExperimentEnabled({
    userId: auth.context.user.id,
    email: auth.context.user.email,
    organizationId,
  });
  if (!aiChatEnabled) {
    return NextResponse.json(
      { error: "AI chat is not enabled for this organization" },
      { status: 403 }
    );
  }

  if (await isChatDeleted(organizationId, chatId)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const body = await request.json();
  const parseResult = updateChatShareSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parseResult.error.issues },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  try {
    const share = await upsertChatShare({
      organizationId,
      chatId,
      ownerUserId: auth.context.user.id,
      visibility: data.visibility,
      password: data.password ?? undefined,
      inviteEmails: data.inviteEmails,
      allowFork: data.allowFork,
      expiresAt:
        data.expiresAt === undefined
          ? undefined
          : data.expiresAt instanceof Date
            ? data.expiresAt
            : null,
    });
    return NextResponse.json({ share: serializeShare(request, share) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update share";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { organizationId, chatId } = await params;
  const auth = await withOrganizationAuth(request, organizationId);
  if (!auth.success) {
    return auth.response;
  }

  await deleteChatShare(organizationId, chatId);
  return NextResponse.json({ share: serializeShare(request, null) });
}
