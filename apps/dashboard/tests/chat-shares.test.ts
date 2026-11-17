import { afterAll, describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { chatSessions, organizations, users } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";

if (process.env.NOTRA_CHAT_SHARES_TEST !== "1") {
  test("chat share links, against migrated sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_CHAT_SHARES_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const sandbox = await createAutopilotSandbox();
  const { db } = sandbox;
  mock.module("@notra/db/drizzle", () => ({ db }));
  afterAll(() => sandbox.postgres.close());

  const shares = await import("../src/lib/chat/shares");

  const ORG = "org-share";
  const USER = "user-share";
  const now = new Date();
  await db.insert(users).values({
    id: USER,
    name: "Sharer",
    email: "sharer@example.invalid",
    createdAt: now,
    updatedAt: now,
  });
  await db
    .insert(organizations)
    .values({ id: ORG, name: "Acme", slug: "acme", createdAt: now });

  const text = (id: string, role: "user" | "assistant", value: string) => ({
    id,
    role,
    parts: [{ type: "text", text: value }],
  });

  let chatCount = 0;
  const createChat = async () => {
    chatCount += 1;
    const chatId = `chat-${chatCount}`;
    await db.insert(chatSessions).values({
      id: chatId,
      organizationId: ORG,
      title: "Launch post",
      messages: [text("m1", "user", "First message")],
    });
    return chatId;
  };

  const addMessage = async (chatId: string, value: string) => {
    const [row] = await db
      .select({ messages: chatSessions.messages })
      .from(chatSessions)
      .where(eq(chatSessions.id, chatId));
    const messages = row?.messages as unknown[];
    await db
      .update(chatSessions)
      .set({
        messages: [...messages, text(`m${messages.length + 1}`, "user", value)],
      })
      .where(eq(chatSessions.id, chatId));
  };

  const publicText = async (shareId: string) => {
    const share = await shares.getPublicChatShare(shareId);
    return JSON.stringify(share?.messages ?? null);
  };

  const publish = async (chatId: string) => {
    const share = await shares.publishChatShare({
      organizationId: ORG,
      chatId,
      userId: USER,
    });
    if (!share) {
      throw new Error("publish returned null");
    }
    return share;
  };

  describe("chat share links", () => {
    test("a frozen link ignores messages sent after sharing", async () => {
      const chatId = await createChat();
      const share = await publish(chatId);
      expect(share.autoUpdate).toBe(false);

      await addMessage(chatId, "Sent after sharing");

      const body = await publicText(share.shareId);
      expect(body).toContain("First message");
      expect(body).not.toContain("Sent after sharing");
    });

    test("a live link shows messages sent after turning it on", async () => {
      const chatId = await createChat();
      const share = await publish(chatId);
      const live = await shares.setChatShareAutoUpdate({
        organizationId: ORG,
        chatId,
        autoUpdate: true,
      });
      expect(live?.autoUpdate).toBe(true);
      expect(live?.shareId).toBe(share.shareId);

      await addMessage(chatId, "Sent while live");

      expect(await publicText(share.shareId)).toContain("Sent while live");
    });

    test("turning live updates off freezes the chat as it is now", async () => {
      const chatId = await createChat();
      const share = await publish(chatId);
      await shares.setChatShareAutoUpdate({
        organizationId: ORG,
        chatId,
        autoUpdate: true,
      });
      await addMessage(chatId, "Sent while live");

      const frozen = await shares.setChatShareAutoUpdate({
        organizationId: ORG,
        chatId,
        autoUpdate: false,
      });
      expect(frozen?.shareId).toBe(share.shareId);
      await addMessage(chatId, "Sent after freezing");

      const body = await publicText(share.shareId);
      expect(body).toContain("Sent while live");
      expect(body).not.toContain("Sent after freezing");
    });

    test("a deleted link stays gone, live or not", async () => {
      const chatId = await createChat();
      const share = await publish(chatId);
      await shares.setChatShareAutoUpdate({
        organizationId: ORG,
        chatId,
        autoUpdate: true,
      });

      expect(await shares.revokeChatShare(ORG, chatId)).toBe(true);

      expect(await shares.getPublicChatShare(share.shareId)).toBeNull();
      expect(
        await shares.setChatShareAutoUpdate({
          organizationId: ORG,
          chatId,
          autoUpdate: false,
        })
      ).toBeNull();
    });
  });
}
