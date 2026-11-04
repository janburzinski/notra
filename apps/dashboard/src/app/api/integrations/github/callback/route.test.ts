import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_GITHUB_INSTALL_CALLBACK_TEST !== "1") {
  test("GitHub App install callback", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_GITHUB_INSTALL_CALLBACK_TEST: "1" },
        timeout: 15_000,
      }
    );
    expect(result.status, result.stderr.toString()).toBe(0);
  }, 20_000);
} else {
  const APP_URL = "https://app.test";
  const installState = {
    organizationId: "org-1",
    userId: "user-1",
    callbackPath: "/acme/sites/new",
  };
  const upsertInstallation = mock(async (_params: unknown) => ({
    accountId: "account-1",
  }));

  class GitHubError extends Error {}
  mock.module("@notra/ai/integrations/github", () => ({
    GitHubAccountRequiredError: GitHubError,
    GitHubInstallationAccessDeniedError: GitHubError,
    GitHubReauthorizationRequiredError: GitHubError,
    upsertGitHubAppInstallation: upsertInstallation,
  }));
  mock.module("@notra/ai/utils/redis", () => ({
    redis: {
      get: async (key: string) =>
        key === "github_app_install:state-1" ? installState : null,
    },
  }));
  mock.module("@notra/ai/utils/server-log", () => ({ logError: mock() }));
  mock.module("@notra/ai/utils/url", () => ({ getAppUrl: () => APP_URL }));
  mock.module("@tanstack/react-start/server", () => ({
    getCookie: () => undefined,
  }));
  mock.module("@/lib/auth/session", () => ({
    getServerSession: async () => ({
      session: { userId: "user-1" },
      user: { id: "user-1" },
    }),
  }));
  mock.module("@/lib/auth/organization", () => ({
    assertOrganizationAccess: async () => undefined,
  }));
  mock.module("@/lib/integrations/connect-events", () => ({
    trackIntegrationConnected: mock(),
    trackIntegrationConnectFailed: mock(),
  }));
  mock.module("@/utils/ratelimit", () => ({
    ratelimit: {
      githubAppCallback: { limit: async () => ({ success: true }) },
    },
  }));

  const { GET } = await import("./route");

  const callback = (query: string) =>
    GET(new Request(`${APP_URL}/api/integrations/github/callback?${query}`));

  beforeEach(() => {
    upsertInstallation.mockClear();
  });

  test("an installation request returns to the page with a notice", async () => {
    const response = await callback("setup_action=request&state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubInstallRequested=true`
    );
    expect(upsertInstallation).not.toHaveBeenCalled();
  });

  test("an installation request cannot link an installation id it carries", async () => {
    const response = await callback(
      "setup_action=request&installation_id=123&state=state-1"
    );

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubInstallRequested=true`
    );
    expect(upsertInstallation).not.toHaveBeenCalled();
  });

  test("a completed install is still linked", async () => {
    const response = await callback(
      "setup_action=install&installation_id=123&state=state-1"
    );

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubConnected=true&githubAccountId=account-1`
    );
    expect(upsertInstallation).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      installationId: "123",
    });
  });

  test("a callback without an installation still reports missing parameters", async () => {
    const response = await callback("state=state-1");

    expect(response.headers.get("location")).toBe(
      `${APP_URL}/acme/sites/new?githubError=invalid_callback`
    );
  });
}
