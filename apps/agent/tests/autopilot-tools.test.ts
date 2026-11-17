import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const store = new Map<string, string>();
mock.module("@notra/ai/utils/redis", () => ({
  redis: {
    set: async (key: string, value: string, options?: { nx?: boolean }) => {
      if (options?.nx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return "OK";
    },
    get: async (key: string) => store.get(key) ?? null,
  },
}));
mock.module("@notra/ai/qstash/triggers", () => ({
  getBaseUrl: () => "https://dashboard.test",
}));

const { default: actOnFinding } =
  await import("../agent/tools/act_on_autopilot_finding");
const { default: getStatus } =
  await import("../agent/tools/get_autopilot_status");
const { default: updateSettings } =
  await import("../agent/tools/update_autopilot_settings");

function slackAuth(userId: string) {
  return {
    authenticator: "slack-webhook",
    issuer: "slack:T1",
    principalId: `slack:T1:${userId}`,
    principalType: "user",
    attributes: {
      user_id: userId,
      team_id: "T1",
      channel_id: "C1",
      thread_ts: "1700000000.000100",
      organizationId: "org_1",
    },
  };
}

function toolContext(current: unknown, initiator: unknown = current) {
  return {
    callId: "call_1",
    toolName: "act_on_autopilot_finding",
    session: { auth: { current, initiator } },
  };
}

type ApprovalConfig = {
  request: (ctx: unknown) => Promise<unknown>;
  response: (ctx: unknown) => Promise<{ status: string }>;
};

function approvalOf(tool: unknown) {
  return (tool as { approval: ApprovalConfig }).approval;
}

function responseContext(responder: unknown, initiator: unknown) {
  return {
    request: {
      callId: "call_1",
      interactionId: "interaction_1",
      principal: initiator,
      toolName: "x",
    },
    response: { decision: "approve", principal: responder },
    session: { id: "s1", initiator, turn: { id: "t1", sequence: 1 } },
    auth: {},
  };
}

const originalFetch = globalThis.fetch;
const originalSecret = process.env.INTERNAL_WORKFLOW_SECRET;

beforeEach(() => {
  store.clear();
  process.env.INTERNAL_WORKFLOW_SECRET = "secret_fixture";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.INTERNAL_WORKFLOW_SECRET = originalSecret;
});

describe("autopilot approval", () => {
  test("writing an idea needs no confirmation", async () => {
    const approval = approvalOf(actOnFinding);
    expect(
      await approval.request({
        ...toolContext(slackAuth("U1")),
        toolInput: { findingId: "f1", action: "write" },
      })
    ).toBe("not-applicable");
  });

  test("dismissing asks the requester and only they can approve", async () => {
    const approval = approvalOf(actOnFinding);
    expect(
      await approval.request({
        ...toolContext(slackAuth("U1"), slackAuth("U0")),
        toolInput: { findingId: "f1", action: "dismiss" },
      })
    ).toBe("user-approval");
    await approval.request({
      ...toolContext(slackAuth("U2"), slackAuth("U0")),
      toolInput: { findingId: "f1", action: "dismiss" },
    });
    expect(
      (
        await approval.response(
          responseContext(slackAuth("U2"), slackAuth("U0"))
        )
      ).status
    ).toBe("rejected");
    expect(
      (
        await approval.response(
          responseContext(slackAuth("U0"), slackAuth("U0"))
        )
      ).status
    ).toBe("rejected");
    expect(
      (
        await approval.response(
          responseContext(slackAuth("U1"), slackAuth("U0"))
        )
      ).status
    ).toBe("allowed");
  });

  test("nobody can approve when the requester was not recorded", async () => {
    expect(
      (
        await approvalOf(actOnFinding).response(
          responseContext(slackAuth("U0"), slackAuth("U0"))
        )
      ).status
    ).toBe("rejected");
  });

  test("a missing input still asks for confirmation", async () => {
    expect(
      await approvalOf(actOnFinding).request(toolContext(slackAuth("U1")))
    ).toBe("user-approval");
  });

  test("pausing needs confirmation but moving the brief does not", async () => {
    const approval = approvalOf(updateSettings);
    expect(
      await approval.request({
        ...toolContext(slackAuth("U1")),
        toolInput: { briefHour: 8 },
      })
    ).toBe("not-applicable");
    expect(
      await approval.request({
        ...toolContext(slackAuth("U1")),
        toolInput: { jobs: { keywords: false } },
      })
    ).toBe("user-approval");
  });

  test("destructive changes outside Slack are denied", async () => {
    const result = await approvalOf(updateSettings).request({
      ...toolContext({
        authenticator: "app",
        principalId: "eve:app",
        principalType: "runtime",
        attributes: { organizationId: "org_1" },
      }),
      toolInput: { enabled: false },
    });
    expect(result).toMatchObject({ type: "denied" });
  });
});

describe("autopilot dashboard calls", () => {
  type StatusTool = {
    execute: (input: unknown, ctx: unknown) => Promise<unknown>;
  };

  test("sends the session organization and Slack user, never model input", async () => {
    const requests: { url: string; body: unknown; auth: string | null }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      requests.push({
        url,
        body: JSON.parse(String(init.body)),
        auth: new Headers(init.headers).get("authorization"),
      });
      return Response.json({ ok: true });
    }) as typeof fetch;
    await (actOnFinding as unknown as StatusTool).execute(
      { findingId: "f1", action: "dismiss", reason: "not our audience" },
      toolContext(slackAuth("U1"), slackAuth("U0"))
    );
    expect(requests).toEqual([
      {
        url: "https://dashboard.test/api/internal/autopilot/agent",
        auth: "Bearer secret_fixture",
        body: {
          organizationId: "org_1",
          slack: {
            teamId: "T1",
            userId: "U1",
            channelId: "C1",
            threadTs: "1700000000.000100",
          },
          action: {
            type: "finding",
            input: {
              findingId: "f1",
              action: "dismiss",
              reason: "not our audience",
            },
          },
        },
      },
    ]);
  });

  test("passes the dashboard's error message on", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        {
          error: "Only Notra workspace owners and admins can change Autopilot.",
        },
        { status: 403 }
      )) as unknown as typeof fetch;
    await expect(
      (getStatus as unknown as StatusTool).execute(
        {},
        toolContext(slackAuth("U1"))
      )
    ).rejects.toThrow("Only Notra workspace owners and admins");
  });

  test("refuses sessions without a Slack user", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({})
    ) as unknown as typeof fetch;
    await expect(
      (getStatus as unknown as StatusTool).execute(
        {},
        toolContext({
          authenticator: "app",
          principalId: "eve:app",
          principalType: "runtime",
          attributes: { organizationId: "org_1" },
        })
      )
    ).rejects.toThrow("only be controlled by a person in Slack");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
