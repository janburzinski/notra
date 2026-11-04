import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_GITHUB_ACCOUNT_LINK_TEST !== "1") {
  test("GitHub account link callback", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_GITHUB_ACCOUNT_LINK_TEST: "1" },
        timeout: 15_000,
      }
    );
    expect(result.status, result.stderr.toString()).toBe(0);
  }, 20_000);
} else {
  const APP_URL = "https://app.test";
  const linkState = {
    userId: "user-1",
    returnTo: "/acme/sites/new?githubAccountConnected=true",
    callbackPath: "/acme/sites/new",
  };
  const states = new Map<string, unknown>();
  const sessionUser = { id: "user-1" as string | null };
  const linkAccount = mock(async (_params: unknown) => undefined);

  mock.module("@notra/ai/integrations/github", () => ({
    linkGitHubUserAccount: linkAccount,
  }));
  mock.module("@notra/ai/utils/redis", () => ({
    redis: {
      getdel: async (key: string) => {
        const value = states.get(key) ?? null;
        states.delete(key);
        return value;
      },
    },
  }));
  mock.module("@notra/ai/utils/server-log", () => ({ logError: mock() }));
  mock.module("@notra/ai/utils/url", () => ({ getAppUrl: () => APP_URL }));
  mock.module("@/lib/auth/session", () => ({
    getServerSession: async () => ({
      session: sessionUser.id ? { userId: sessionUser.id } : null,
    }),
  }));
  mock.module("@/lib/integrations/connect-events", () => ({
    trackIntegrationConnectFailed: mock(),
  }));
  mock.module("@/utils/ratelimit", () => ({
    ratelimit: {
      githubAppCallback: { limit: async () => ({ success: true }) },
    },
  }));

  const { GET } = await import("./route");

  const callback = (query: string) =>
    GET(
      new Request(
        `${APP_URL}/api/integrations/github/account/callback?${query}`
      )
    );

  beforeEach(() => {
    states.clear();
    states.set("github_account_link:state-1", linkState);
    sessionUser.id = "user-1";
    linkAccount.mockClear();
    linkAccount.mockImplementation(async () => undefined);
  });

  test("links the account for the signed-in user and continues to returnTo", async () => {
    const response = await callback("code=code-1&state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}${linkState.returnTo}`
    );
    expect(linkAccount).toHaveBeenCalledWith({
      userId: "user-1",
      code: "code-1",
      redirectUri: `${APP_URL}/api/integrations/github/account/callback`,
    });
  });

  test("state is single use", async () => {
    await callback("code=code-1&state=state-1");
    const replay = await callback("code=code-2&state=state-1");

    expect(replay.headers.get("location")).toBe(
      `${APP_URL}/?error=expired_state`
    );
    expect(linkAccount).toHaveBeenCalledTimes(1);
  });

  test("never links the account to a different signed-in user", async () => {
    sessionUser.id = "user-2";
    const response = await callback("code=code-1&state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubError=session_mismatch`
    );
    expect(linkAccount).not.toHaveBeenCalled();
  });

  test("declining on GitHub returns to the page with a message", async () => {
    const response = await callback("error=access_denied&state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubError=account_link_cancelled`
    );
    expect(linkAccount).not.toHaveBeenCalled();
  });

  test("a failed token exchange returns to the page instead of the dashboard", async () => {
    linkAccount.mockImplementation(async () => {
      throw new Error("bad_verification_code");
    });
    const response = await callback("code=bad&state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubError=github_callback_failed`
    );
  });

  test("an unknown state cannot redirect anywhere it chooses", async () => {
    const response = await callback("code=code-1&state=unknown");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/?error=expired_state`
    );
    expect(linkAccount).not.toHaveBeenCalled();
  });
}
