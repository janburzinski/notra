import { db } from "@notra/db/drizzle";
import {
  chatShareInvitees,
  chatShares,
  members,
  users,
} from "@notra/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ChatVisibility } from "@/schemas/chat-share";
import { hashSharePassword } from "./share-password";

export type ChatShareRow = typeof chatShares.$inferSelect;
export type ChatShareInviteeRow = typeof chatShareInvitees.$inferSelect;

export interface ChatShareWithInvitees extends ChatShareRow {
  invitees: ChatShareInviteeRow[];
}

export async function getChatShareForOwner(
  organizationId: string,
  chatId: string
): Promise<ChatShareWithInvitees | null> {
  const share = await db.query.chatShares.findFirst({
    where: and(
      eq(chatShares.organizationId, organizationId),
      eq(chatShares.chatId, chatId)
    ),
    with: { invitees: true },
  });
  return share ?? null;
}

export async function getChatShareByToken(
  token: string
): Promise<ChatShareWithInvitees | null> {
  const share = await db.query.chatShares.findFirst({
    where: eq(chatShares.shareToken, token),
    with: { invitees: true },
  });
  return share ?? null;
}

function needsToken(visibility: ChatVisibility): boolean {
  return visibility === "link" || visibility === "password";
}

function generateShareToken() {
  return nanoid(24);
}

interface UpsertInput {
  organizationId: string;
  chatId: string;
  ownerUserId: string;
  visibility: ChatVisibility;
  password?: string | null;
  inviteEmails?: string[];
  allowFork?: boolean;
  expiresAt?: Date | null;
}

export async function upsertChatShare(
  input: UpsertInput
): Promise<ChatShareWithInvitees> {
  const existing = await getChatShareForOwner(
    input.organizationId,
    input.chatId
  );

  const previousVisibility = existing?.visibility ?? null;
  const targetsToken = needsToken(input.visibility);
  const visibilityChanged =
    previousVisibility !== null && previousVisibility !== input.visibility;

  let shareToken: string | null = existing?.shareToken ?? null;
  if (!targetsToken) {
    shareToken = null;
  } else if (!shareToken || visibilityChanged) {
    shareToken = generateShareToken();
  }

  let passwordHash: string | null = existing?.passwordHash ?? null;
  if (input.visibility !== "password") {
    passwordHash = null;
  } else if (input.password) {
    passwordHash = await hashSharePassword(input.password);
  } else if (!passwordHash) {
    throw new Error("Password required for password-protected share");
  }

  const values = {
    organizationId: input.organizationId,
    chatId: input.chatId,
    ownerUserId: input.ownerUserId,
    visibility: input.visibility,
    shareToken,
    passwordHash,
    allowFork: input.allowFork ?? existing?.allowFork ?? false,
    expiresAt:
      input.expiresAt === undefined
        ? (existing?.expiresAt ?? null)
        : input.expiresAt,
  };

  let shareId: string;
  if (existing) {
    shareId = existing.id;
    await db
      .update(chatShares)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(chatShares.id, existing.id));
  } else {
    shareId = nanoid(24);
    await db.insert(chatShares).values({ id: shareId, ...values });
  }

  if (input.visibility === "private") {
    const emails = (input.inviteEmails ?? []).map((email) =>
      email.trim().toLowerCase()
    );
    const uniqueEmails = Array.from(new Set(emails));
    await db
      .delete(chatShareInvitees)
      .where(eq(chatShareInvitees.shareId, shareId));

    if (uniqueEmails.length > 0) {
      const matchingUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, uniqueEmails));
      const userIdByEmail = new Map(
        matchingUsers.map((row) => [row.email.toLowerCase(), row.id])
      );

      await db.insert(chatShareInvitees).values(
        uniqueEmails.map((email) => ({
          id: nanoid(24),
          shareId,
          email,
          userId: userIdByEmail.get(email) ?? null,
        }))
      );
    }
  } else {
    await db
      .delete(chatShareInvitees)
      .where(eq(chatShareInvitees.shareId, shareId));
  }

  const updated = await getChatShareForOwner(
    input.organizationId,
    input.chatId
  );
  if (!updated) {
    throw new Error("Failed to load chat share after upsert");
  }
  return updated;
}

export async function deleteChatShare(
  organizationId: string,
  chatId: string
): Promise<boolean> {
  const result = await db
    .delete(chatShares)
    .where(
      and(
        eq(chatShares.organizationId, organizationId),
        eq(chatShares.chatId, chatId)
      )
    )
    .returning({ id: chatShares.id });
  return result.length > 0;
}

export function isShareExpired(share: ChatShareRow): boolean {
  return share.expiresAt !== null && share.expiresAt.getTime() <= Date.now();
}

export async function isUserOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const row = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export function isEmailInvited(
  share: ChatShareWithInvitees,
  email: string | null | undefined
): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return share.invitees.some(
    (invitee) => invitee.email.toLowerCase() === normalized
  );
}

const TRAILING_SLASH_REGEX = /\/$/;

export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(TRAILING_SLASH_REGEX, "")}/shared/${token}`;
}
