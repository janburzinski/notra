import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Runs in its own process: other test files mock "@/lib/auth/organization"
// without withOrganizationAuth, and Bun module mocks are process-wide.
if (process.env.NOTRA_SLACK_RELAY_ROUTE_TEST_WORKER !== "1") {
  test("Slack relay route enforces chat limits before posting", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_SLACK_RELAY_ROUTE_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  const CHAT_ID = "5b0a1c3e-2f4d-4e6a-8b9c-0d1e2f3a4b5c";

  const generationLimit = mock(async () => null as Response | null);
  const checkChatBilling = mock(async () => ({
    allowed: true,
    mode: "ai_credits",
    chargeAiCredits: true,
    useMarkup: false,
    balanceRemaining: 10,
  }));
  const postSlackRelayMessage = mock(async () => ({ ts: "2.0" }));

  mock.module("@/lib/auth/organization", () => ({
    withOrganizationAuth: async () => ({
      success: true,
      context: { user: { id: "user-1", name: "Ada", email: null } },
    }),
  }));
  mock.module("@/utils/ratelimit", () => ({
    ratelimit: { chatRelay: { limit: async () => ({ success: true }) } },
  }));
  mock.module("@/utils/chat-ratelimit", () => ({
    enforceChatGenerationRatelimit: generationLimit,
  }));
  mock.module("@notra/ai/billing/chat-billing", () => ({ checkChatBilling }));
  mock.module("@notra/ai/chat/history", () => ({
    getChatSession: async () => ({
      externalChannelId: { source: "slack", id: "T1:C1:1.0" },
    }),
    appendChatMessageIfMissing: async () => {},
  }));
  mock.module("@notra/ai/chat/mirror", () => ({
    publishChatMirrorMessage: async () => {},
  }));
  mock.module("@/lib/slack/relay", () => ({
    parseSlackExternalChannelKey: () => ({
      teamId: "T1",
      channelId: "C1",
      threadTs: "1.0",
    }),
    postSlackRelayMessage,
  }));

  const { POST } =
    await import("../src/app/api/organizations/[organizationId]/chat/[chatId]/relay/route");

  const relay = () =>
    POST(
      new Request("http://localhost/relay", {
        method: "POST",
        body: JSON.stringify({ text: "Draft a launch tweet" }),
      }),
      {
        params: Promise.resolve({ organizationId: "org-1", chatId: CHAT_ID }),
      } as never
    );

  beforeEach(() => {
    generationLimit.mockClear();
    checkChatBilling.mockClear();
    postSlackRelayMessage.mockClear();
  });

  test("relays count against the shared chat generation limit", async () => {
    generationLimit.mockImplementationOnce(async () =>
      Response.json({ error: "Rate limit exceeded" }, { status: 429 })
    );

    const response = await relay();

    expect(response.status).toBe(429);
    expect(generationLimit).toHaveBeenCalledWith("org-1", "user-1");
    expect(postSlackRelayMessage).not.toHaveBeenCalled();
  });

  test("relays are rejected before posting when the workspace is out of credits", async () => {
    checkChatBilling.mockImplementationOnce(async () => ({
      allowed: false,
      mode: "ai_credits",
      chargeAiCredits: false,
      useMarkup: false,
      balanceRemaining: 0,
    }));

    const response = await relay();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "USAGE_LIMIT_REACHED",
    });
    expect(postSlackRelayMessage).not.toHaveBeenCalled();
  });

  test("allowed relays are posted to the Slack thread", async () => {
    const response = await relay();

    expect(response.status).toBe(200);
    expect(postSlackRelayMessage).toHaveBeenCalledTimes(1);
  });
}
