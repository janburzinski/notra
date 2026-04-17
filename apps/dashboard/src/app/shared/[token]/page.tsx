import { db } from "@notra/db/drizzle";
import { organizations, users } from "@notra/db/schema";
import { buttonVariants } from "@notra/ui/components/ui/button";
import { eq } from "drizzle-orm";
import { ClockIcon, LockIcon, SearchXIcon, ShieldOffIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers as nextHeaders } from "next/headers";
import Link from "next/link";
import {
  GateShell,
  SharePasswordGate,
} from "@/components/shared-chat/share-password-gate";
import { SharedChatView } from "@/components/shared-chat/shared-chat-view";
import { getServerSession } from "@/lib/auth/session";
import {
  getChatSession,
  isChatDeleted,
  loadChatHistory,
} from "@/lib/chat-history";
import {
  getChatShareByToken,
  isEmailInvited,
  isShareExpired,
  isUserOrganizationMember,
} from "@/lib/chat-shares";
import { getShareAccessCookieName } from "@/lib/share-cookies";
import { normalizeChatTitle } from "@/utils/chat";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await getChatShareByToken(token);
  if (!share || isShareExpired(share)) {
    return { title: "Shared chat" };
  }
  const session = await getChatSession(share.organizationId, share.chatId);
  const title = session?.title ?? "Shared chat";
  const isPublic = share.visibility === "link" && !share.passwordHash;
  return {
    title,
    description: isPublic ? "A chat shared via Notra" : undefined,
    robots: isPublic ? undefined : { index: false, follow: false },
    openGraph: isPublic
      ? {
          title,
          description: "A chat shared via Notra",
          type: "article",
        }
      : undefined,
  };
}

export default async function SharedChatPage({ params }: PageProps) {
  const { token } = await params;
  const [share, headersList] = await Promise.all([
    getChatShareByToken(token),
    nextHeaders(),
  ]);

  if (!share) {
    return (
      <GateShell
        description="This shared chat doesn't exist or has been removed."
        icon={<SearchXIcon className="size-5" />}
        title="Chat not found"
      />
    );
  }

  if (isShareExpired(share)) {
    return (
      <GateShell
        description="This share link has expired. Ask the owner for a new link."
        icon={<ClockIcon className="size-5" />}
        title="Link expired"
      />
    );
  }

  if (await isChatDeleted(share.organizationId, share.chatId)) {
    return (
      <GateShell
        description="The owner deleted this chat, so it can no longer be viewed."
        icon={<SearchXIcon className="size-5" />}
        title="Chat no longer available"
      />
    );
  }

  const { user } = await getServerSession({ headers: headersList });
  const isViewerOrgMember = user
    ? await isUserOrganizationMember(user.id, share.organizationId)
    : false;

  if (share.visibility === "private") {
    if (!user) {
      return <LoginGate token={token} />;
    }
    if (!isEmailInvited(share, user.email)) {
      return (
        <GateShell
          description="You are not on the access list for this chat."
          icon={<ShieldOffIcon className="size-5" />}
          title="No access"
        />
      );
    }
  } else if (share.visibility === "organization") {
    if (!user) {
      return <LoginGate token={token} />;
    }
    if (!isViewerOrgMember) {
      return (
        <GateShell
          description="This chat is only shared with members of its organization."
          icon={<ShieldOffIcon className="size-5" />}
          title="Members only"
        />
      );
    }
  } else if (share.visibility === "password") {
    const cookieStore = await cookies();
    const hasAccess =
      cookieStore.get(getShareAccessCookieName(token))?.value === "1";
    if (!hasAccess) {
      return <SharePasswordGate shareToken={token} />;
    }
  }

  const [messages, session, owner, organization] = await Promise.all([
    loadChatHistory(share.organizationId, share.chatId),
    getChatSession(share.organizationId, share.chatId),
    db.query.users.findFirst({
      where: eq(users.id, share.ownerUserId),
      columns: { name: true },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, share.organizationId),
      columns: { name: true, slug: true },
    }),
  ]);

  const title = session?.title
    ? normalizeChatTitle(session.title)
    : normalizeChatTitle("Shared chat");

  const workspaceUrl =
    isViewerOrgMember && organization?.slug
      ? `/${organization.slug}/chat/${share.chatId}`
      : null;

  return (
    <SharedChatView
      allowFork={share.allowFork}
      isAuthenticated={Boolean(user)}
      messages={messages}
      organizationName={organization?.name ?? null}
      ownerName={owner?.name ?? null}
      shareToken={token}
      title={title}
      workspaceUrl={workspaceUrl}
    />
  );
}

function LoginGate({ token }: { token: string }) {
  const callbackUrl = encodeURIComponent(`/shared/${token}`);
  return (
    <GateShell
      description="Sign in to view this shared chat."
      icon={<LockIcon className="size-5" />}
      title="Sign in required"
    >
      <Link
        className={buttonVariants()}
        href={`/login?callbackUrl=${callbackUrl}`}
      >
        Sign in
      </Link>
    </GateShell>
  );
}
