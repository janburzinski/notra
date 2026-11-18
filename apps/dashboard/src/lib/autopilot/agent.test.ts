import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_AUTOPILOT_AGENT_TEST !== "1") {
  test("Slack control of Autopilot maps members and enforces roles", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_AGENT_TEST: "1",
          DATABASE_URL: "",
          NEXT_PUBLIC_DEMO_MODE: "false",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr?.toString()).toBe(0);
  }, 25_000);
} else {
  const schema = await import("@notra/db/schema");
  const state = {
    entitled: true,
    integration: { id: "slk_1", encryptedBotToken: "enc" } as unknown,
    memberRows: [] as { userId: string; role: string }[],
    destination: [{ organizationId: "org_1", encryptedBotToken: "enc" }],
    finding: null as unknown,
  };
  const slackUsers: Record<string, unknown> = {};
  let usersInfoCalls = 0;
  globalThis.fetch = (async (url: string) => {
    usersInfoCalls += 1;
    const user = new URL(url).searchParams.get("user") ?? "";
    return Response.json(
      slackUsers[user] ?? { ok: false, error: "user_not_found" }
    );
  }) as unknown as typeof fetch;

  const redisStore = new Map<string, string>();
  mock.module("@notra/ai/utils/redis", () => ({
    redis: {
      set: async (key: string, value: string) => {
        redisStore.set(key, value);
        return "OK";
      },
      del: async (key: string) => {
        redisStore.delete(key);
        return 1;
      },
      mget: async (...keys: string[]) =>
        keys.map((key) => redisStore.get(key) ?? null),
    },
  }));

  const selectResult = (table: unknown) => {
    if (table === schema.members) {
      return state.memberRows;
    }
    if (table === schema.autopilotSettings) {
      return state.destination;
    }
    return [];
  };
  mock.module("@notra/db/drizzle", () => ({
    db: {
      query: {
        slackIntegrations: { findFirst: async () => state.integration },
        autopilotFindings: {
          findFirst: async () => state.finding ?? undefined,
          findMany: async () => [],
        },
        autopilotSettings: { findFirst: async () => undefined },
        autopilotRuns: { findMany: async () => [] },
      },
      select: () => {
        let table: unknown;
        const chain = {
          from: (value: unknown) => {
            table = value;
            return chain;
          },
          innerJoin: () => chain,
          where: () =>
            Object.assign(Promise.resolve(selectResult(table)), {
              limit: async () => selectResult(table),
            }),
        };
        return chain;
      },
      update: () => ({
        set: () => ({
          where: () =>
            Object.assign(Promise.resolve([]), {
              returning: async () => [{ id: "f1" }],
            }),
        }),
      }),
    },
  }));
  const slackWorkspace = await import("@notra/ai/integrations/slack-workspace");
  mock.module("@notra/ai/integrations/slack-workspace", () => ({
    ...slackWorkspace,
    getSlackIntegrationBotToken: () => "xoxb-fixture",
  }));
  mock.module("@/lib/billing/autopilot-entitlement", () => ({
    isAutopilotEnabledForOrganization: async () => state.entitled,
    isAutopilotOffForOrganization: async () => !state.entitled,
    autopilotAccessState: async () => (state.entitled ? "enabled" : "disabled"),
  }));
  const dismissFinding = mock(async () => ({ id: "f1", status: "dismissed" }));
  const findings = await import("@/lib/autopilot/findings");
  mock.module("@/lib/autopilot/findings", () => ({
    ...findings,
    dismissFinding,
    mergeFinding: async () => ({ id: "f1", status: "merged" }),
  }));
  const dismissWithFeedback = mock(async (_params: unknown) => ({
    finding: { id: "f1", status: "dismissed" },
    rule: "Skip pricing posts",
  }));
  const writeSuggested = mock(async () => "run_1");
  const findingActions = await import("@/lib/autopilot/finding-actions");
  mock.module("@/lib/autopilot/finding-actions", () => ({
    ...findingActions,
    dismissFindingWithFeedback: dismissWithFeedback,
    writeSuggestedFinding: writeSuggested,
  }));
  const deleteRule = mock(async () => undefined);
  const rules = await import("@/lib/autopilot/rules");
  mock.module("@/lib/autopilot/rules", () => ({
    ...rules,
    listRules: async () => [{ id: "rule_1", text: "Skip pricing" }],
    addRule: async () => ({ status: "added", rule: { id: "rule_2" } }),
    deleteRule,
    extractRule: async () => null,
  }));
  const memory = await import("@/lib/autopilot/memory");
  mock.module("@/lib/autopilot/memory", () => ({
    ...memory,
    rememberFeedback: async () => undefined,
  }));
  const replies: string[] = [];
  const autopilotSlack = await import("@/lib/autopilot/slack");
  mock.module("@/lib/autopilot/slack", () => ({
    ...autopilotSlack,
    postAutopilotSlackMessage: async (params: { text: string }) => {
      replies.push(params.text);
    },
  }));
  const workflows = await import("@/lib/autopilot/workflows/service");
  mock.module("@/lib/autopilot/workflows/service", () => ({
    ...workflows,
    listAutopilotWorkflows: async () => [],
  }));

  const {
    clearSlackMemberCache,
    listSlackIntegrationsMissingScopes,
    resolveSlackMember,
  } = await import("@/lib/integrations/slack/member");
  const { handleAutopilotAgentRequest } = await import("./agent");
  const { handleAutopilotSlackAction } = await import("./slack-actions");

  const slackUser = (id: string, overrides: Record<string, unknown> = {}) => {
    slackUsers[id] = {
      ok: true,
      user: {
        team_id: "T1",
        profile: { email: `${id.toLowerCase()}@acme.test` },
        ...overrides,
      },
    };
  };

  const request = (userId: string, action: unknown) =>
    ({
      organizationId: "org_1",
      slack: { teamId: "T1", userId },
      action,
    }) as Parameters<typeof handleAutopilotAgentRequest>[0];

  test("maps a Slack user to a Notra member and caches it", async () => {
    clearSlackMemberCache();
    slackUser("UADMIN");
    state.memberRows = [{ userId: "user_admin", role: "admin" }];
    usersInfoCalls = 0;
    expect(await resolveSlackMember("org_1", "T1", "UADMIN")).toEqual({
      status: "member",
      userId: "user_admin",
      email: "uadmin@acme.test",
      role: "admin",
    });
    await resolveSlackMember("org_1", "T1", "UADMIN");
    expect(usersInfoCalls).toBe(1);
    state.memberRows = [];
    expect((await resolveSlackMember("org_1", "T1", "UADMIN")).status).toBe(
      "unknown"
    );
    expect(usersInfoCalls).toBe(1);
  });

  test("rejects guests, other teams and workspaces without Slack", async () => {
    clearSlackMemberCache();
    state.memberRows = [{ userId: "user_admin", role: "admin" }];
    slackUser("UGUEST", { is_restricted: true });
    slackUser("UOTHER", { team_id: "T2" });
    expect((await resolveSlackMember("org_1", "T1", "UGUEST")).status).toBe(
      "unknown"
    );
    expect((await resolveSlackMember("org_1", "T1", "UOTHER")).status).toBe(
      "unknown"
    );
    state.integration = undefined;
    usersInfoCalls = 0;
    expect((await resolveSlackMember("org_1", "T2", "UADMIN")).status).toBe(
      "unknown"
    );
    expect(usersInfoCalls).toBe(0);
    state.integration = { id: "slk_1", encryptedBotToken: "enc" };
  });

  test("flags installs that lack the users scopes until they work again", async () => {
    clearSlackMemberCache();
    slackUsers.USCOPE = { ok: false, error: "missing_scope" };
    expect(await resolveSlackMember("org_1", "T1", "USCOPE")).toEqual({
      status: "missing_scope",
    });
    expect(await listSlackIntegrationsMissingScopes(["slk_1"])).toEqual(
      new Set(["slk_1"])
    );
    await expect(
      handleAutopilotAgentRequest(request("USCOPE", { type: "status" }))
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/reconnect Slack/),
    });
    slackUser("USCOPE");
    clearSlackMemberCache();
    await resolveSlackMember("org_1", "T1", "USCOPE");
    expect(await listSlackIntegrationsMissingScopes(["slk_1"])).toEqual(
      new Set()
    );
  });

  test("members can read, only admins can change", async () => {
    clearSlackMemberCache();
    slackUser("UMEMBER");
    state.memberRows = [{ userId: "user_member", role: "member" }];
    expect(
      await handleAutopilotAgentRequest(request("UMEMBER", { type: "status" }))
    ).toMatchObject({ canManage: false, threadFindings: [] });
    state.finding = { id: "f1", status: "suggested" };
    await expect(
      handleAutopilotAgentRequest(
        request("UMEMBER", {
          type: "finding",
          input: { findingId: "f1", action: "dismiss" },
        })
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(dismissWithFeedback).not.toHaveBeenCalled();
  });

  test("unlinked Slack users and workspaces without an eligible plan are refused", async () => {
    clearSlackMemberCache();
    slackUser("ULONER");
    state.memberRows = [];
    await expect(
      handleAutopilotAgentRequest(request("ULONER", { type: "status" }))
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/isn't linked/),
    });
    state.entitled = false;
    await expect(
      handleAutopilotAgentRequest(request("ULONER", { type: "status" }))
    ).rejects.toMatchObject({
      status: 402,
      message: expect.stringMatching(/Upgrade/),
    });
    state.entitled = true;
  });

  test("admins dismiss with a reason and ids must belong to the workspace", async () => {
    clearSlackMemberCache();
    slackUser("UOWNER");
    state.memberRows = [{ userId: "user_owner", role: "owner" }];
    state.finding = null;
    await expect(
      handleAutopilotAgentRequest(
        request("UOWNER", {
          type: "finding",
          input: { findingId: "foreign", action: "dismiss" },
        })
      )
    ).rejects.toMatchObject({ status: 404 });
    state.finding = { id: "f1", status: "suggested" };
    expect(
      await handleAutopilotAgentRequest(
        request("UOWNER", {
          type: "finding",
          input: { findingId: "f1", action: "dismiss", reason: "No pricing" },
        })
      )
    ).toEqual({ status: "dismissed", rule: "Skip pricing posts" });
    expect(dismissWithFeedback).toHaveBeenCalledWith({
      organizationId: "org_1",
      findingId: "f1",
      reason: "No pricing",
      createdBy: "uowner@acme.test",
      origin: "slack",
    });
    await expect(
      handleAutopilotAgentRequest(
        request("UOWNER", {
          type: "delete_rule",
          input: { ruleId: "rule_foreign" },
        })
      )
    ).rejects.toMatchObject({ status: 404 });
    expect(deleteRule).not.toHaveBeenCalled();
  });

  test("👎 and 👍 in Slack only act for Notra admins", async () => {
    clearSlackMemberCache();
    state.finding = {
      id: "f1",
      status: "suggested",
      title: "Pricing page",
      evidence: {
        slackMessage: {
          channel: "C1",
          ts: "m1",
          threadTs: "th1",
          status: "suggested",
        },
      },
    };
    slackUser("UREACT");
    state.memberRows = [{ userId: "user_member", role: "member" }];
    replies.length = 0;
    const vote = {
      teamId: "T1",
      channelId: "C1",
      userId: "UREACT",
      messageTs: "m1",
      vote: "down" as const,
    };
    await handleAutopilotSlackAction(vote);
    await handleAutopilotSlackAction({ ...vote, vote: "up" });
    expect(dismissFinding).not.toHaveBeenCalled();
    expect(writeSuggested).not.toHaveBeenCalled();
    expect(replies).toHaveLength(2);
    clearSlackMemberCache();
    state.memberRows = [{ userId: "user_admin", role: "admin" }];
    await handleAutopilotSlackAction(vote);
    expect(dismissFinding).toHaveBeenCalledWith("org_1", "f1");
  });
}
