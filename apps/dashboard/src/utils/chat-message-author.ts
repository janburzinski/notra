import type {
  ChatMessageAuthor,
  ResolveChatMessageAuthorInput,
} from "@/types/chat";

export function toChatMessageAuthor(user: {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}): ChatMessageAuthor {
  return {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
    seed: user.email,
  };
}

export function unknownChatMessageAuthor(
  authorUserId: string
): ChatMessageAuthor {
  return { id: authorUserId, name: null, image: null, seed: authorUserId };
}

/** Slack threads are shared by nature, so they always show who wrote what. */
export function shouldShowChatAuthorAvatars({
  isSlackMirrored,
  memberCount,
}: {
  isSlackMirrored: boolean;
  memberCount: number;
}) {
  return isSlackMirrored || memberCount > 1;
}

export function resolveChatMessageAuthor({
  metadata,
  membersById,
  sessionUser,
  isSlackMirrored = false,
}: ResolveChatMessageAuthorInput): ChatMessageAuthor | null {
  const authorUserId = metadata?.authorUserId;
  if (authorUserId) {
    const member = membersById.get(authorUserId);
    if (member) {
      return member;
    }
    if (sessionUser && sessionUser.id === authorUserId) {
      return toChatMessageAuthor(sessionUser);
    }
    return unknownChatMessageAuthor(authorUserId);
  }
  // The server-stamped sender wins; Slack details only name messages the
  // Slack mirror wrote, which have no Notra sender.
  const slackAuthor = isSlackMirrored ? metadata?.slackAuthor : undefined;
  if (slackAuthor) {
    return {
      id: `slack:${slackAuthor.userId}`,
      name: slackAuthor.name ?? null,
      image: slackAuthor.image ?? null,
      seed: slackAuthor.userId,
      fromSlack: true,
    };
  }
  const externalSource = metadata?.externalChannelId?.source;
  // Slack messages mirrored before senders were recorded have no author.
  if (isSlackMirrored || (externalSource && externalSource !== "dashboard")) {
    return null;
  }
  return sessionUser ? toChatMessageAuthor(sessionUser) : null;
}
