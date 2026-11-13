import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const summary = {
  due: 3,
  refreshed: 1,
  reconnectRequired: 1,
  failed: 0,
  deferred: 1,
};
const refreshDue = mock(async () => summary);
const credentials = mock(
  (): { clientId: string; clientSecret: string } | null => ({
    clientId: "client",
    clientSecret: "secret",
  })
);
// Module mocks are process-wide, so the whole surface is stubbed.
mock.module("@notra/ai/integrations/linear-oauth", () => ({
  getLinearOAuthCredentials: credentials,
  refreshDueLinearAccessTokens: refreshDue,
  connectLinearIntegration: mock(),
  exchangeLinearAuthorizationCode: mock(),
  resolveLinearAccessToken: mock(),
}));
const { GET } = await import("../src/app/api/cron/linear-tokens/route");
const originalSecret = process.env.CRON_SECRET;

const cronRequest = (secret = "cron-test-secret") =>
  new Request("https://example.test/api/cron/linear-tokens", {
    headers: { authorization: `Bearer ${secret}` },
  });

afterAll(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});
beforeEach(() => {
  process.env.CRON_SECRET = "cron-test-secret";
  refreshDue.mockClear();
  refreshDue.mockImplementation(async () => summary);
  credentials.mockClear();
});

describe("Linear token refresh cron", () => {
  test("rejects requests without the cron secret", async () => {
    const response = await GET(cronRequest("wrong"));
    expect(response.status).toBe(401);
    expect(refreshDue).not.toHaveBeenCalled();
  });

  test("returns the refresh summary", async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });

  test("reports failed refreshes as an error", async () => {
    refreshDue.mockImplementation(async () => ({ ...summary, failed: 1 }));
    const response = await GET(cronRequest());
    expect(response.status).toBe(500);
  });

  test("does nothing when Linear OAuth is not configured", async () => {
    credentials.mockImplementationOnce(() => null);
    const response = await GET(cronRequest());
    expect(response.status).toBe(204);
    expect(refreshDue).not.toHaveBeenCalled();
  });
});
