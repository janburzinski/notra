import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAiChatExperimentEnabled } from "@/lib/ai-chat-experiment";
import { withOrganizationAuth } from "@/lib/auth/organization";
import {
  getChatSession,
  isChatDeleted,
  loadChatHistory,
} from "@/lib/chat-history";
import {
  buildShareUrl,
  type ChatShareWithInvitees,
  deleteChatShare,
  getChatShareForOwner,
  upsertChatShare,
} from "@/lib/chat-shares";
import { sendChatShareInviteEmailAction } from "@/lib/email/actions";
import { updateChatShareSchema } from "@/schemas/chat-share";
import { ratelimit } from "@/utils/ratelimit";

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

  const [aiChatEnabled, chatDeleted, share] = await Promise.all([
    isAiChatExperimentEnabled({
      userId: auth.context.user.id,
      email: auth.context.user.email,
      organizationId,
    }),
    isChatDeleted(organizationId, chatId),
    getChatShareForOwner(organizationId, chatId),
  ]);
  if (!aiChatEnabled) {
    return NextResponse.json(
      { error: "AI chat is not enabled for this organization" },
      { status: 403 }
    );
  }
  if (chatDeleted) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ share: serializeShare(request, share) });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { organizationId, chatId } = await params;
  const auth = await withOrganizationAuth(request, organizationId);
  if (!auth.success) {
    return auth.response;
  }

  const { success: allowed } = await ratelimit.shareWrite.limit(
    `${auth.context.user.id}:${chatId}`
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many share updates, slow down" },
      { status: 429 }
    );
  }

  const [aiChatEnabled, chatDeleted, body] = await Promise.all([
    isAiChatExperimentEnabled({
      userId: auth.context.user.id,
      email: auth.context.user.email,
      organizationId,
    }),
    isChatDeleted(organizationId, chatId),
    request.json(),
  ]);
  if (!aiChatEnabled) {
    return NextResponse.json(
      { error: "AI chat is not enabled for this organization" },
      { status: 403 }
    );
  }
  if (chatDeleted) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  const parseResult = updateChatShareSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parseResult.error.issues },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  const [messages, previousShare] = await Promise.all([
    loadChatHistory(organizationId, chatId),
    getChatShareForOwner(organizationId, chatId),
  ]);
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Cannot share an empty chat" },
      { status: 400 }
    );
  }

  if (
    previousShare &&
    previousShare.ownerUserId !== auth.context.user.id &&
    auth.context.membership.role !== "owner" &&
    auth.context.membership.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Only the chat owner can manage sharing" },
      { status: 403 }
    );
  }
  const previousEmails = new Set(
    previousShare?.invitees.map((invitee) => invitee.email.toLowerCase()) ?? []
  );

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

    if (data.visibility === "private" && share.shareToken) {
      const newInvitees = share.invitees.filter(
        (invitee) => !previousEmails.has(invitee.email.toLowerCase())
      );
      if (newInvitees.length > 0) {
        const [session, org] = await Promise.all([
          getChatSession(organizationId, chatId),
          db.query.organizations.findFirst({
            where: eq(organizations.id, organizationId),
            columns: { name: true },
          }),
        ]);
        const shareLink = buildShareUrl(
          request.nextUrl.origin,
          share.shareToken
        );
        const inviterName =
          auth.context.user.name ?? auth.context.user.email ?? "Someone";
        const chatTitle = session?.title ?? "Shared chat";
        const organizationName = org?.name ?? "Notra";
        for (const invitee of newInvitees) {
          void sendChatShareInviteEmailAction({
            inviteeEmail: invitee.email,
            inviterName,
            chatTitle,
            organizationName,
            shareLink,
          }).catch((err) => {
            console.error(
              `[chat-share] invite email to ${invitee.email} failed`,
              err
            );
          });
        }
      }
    }

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

  const existing = await getChatShareForOwner(organizationId, chatId);
  if (
    existing &&
    existing.ownerUserId !== auth.context.user.id &&
    auth.context.membership.role !== "owner" &&
    auth.context.membership.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Only the chat owner can manage sharing" },
      { status: 403 }
    );
  }

  await deleteChatShare(organizationId, chatId);
  return NextResponse.json({ share: serializeShare(request, null) });
}
