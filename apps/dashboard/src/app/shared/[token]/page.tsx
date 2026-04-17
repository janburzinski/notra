import { db } from "@notra/db/drizzle";
import { organizations, users } from "@notra/db/schema";
import { buttonVariants } from "@notra/ui/components/ui/button";
import { eq } from "drizzle-orm";
import { ClockIcon, LockIcon, SearchXIcon, ShieldOffIcon } from "lucide-react";
import { cookies, headers as nextHeaders } from "next/headers";
import Link from "next/link";
import {
  GateShell,
  SharePasswordGate,
} from "@/components/shared-chat/share-password-gate";
import { SharedChatView } from "@/components/shared-chat/shared-chat-view";
import { getServerSession } from "@/lib/auth/session";
import { getChatSession, loadChatHistory } from "@/lib/chat-history";
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

export default async function SharedChatPage({ params }: PageProps) {
  const { token } = await params;
  const share = await getChatShareByToken(token);

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

  const headersList = await nextHeaders();
  const { user } = await getServerSession({ headers: headersList });

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
    const isMember = await isUserOrganizationMember(
      user.id,
      share.organizationId
    );
    if (!isMember) {
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
      columns: { name: true },
    }),
  ]);

  const title = session?.title
    ? normalizeChatTitle(session.title)
    : normalizeChatTitle("Shared chat");

  return (
    <SharedChatView
      allowFork={share.allowFork}
      isAuthenticated={Boolean(user)}
      messages={messages}
      organizationName={organization?.name ?? null}
      ownerName={owner?.name ?? null}
      shareToken={token}
      title={title}
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
