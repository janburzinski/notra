import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  InternalDashboardError,
  InternalDashboardTimeoutError,
} from "@notra/schemas/api/internal-dashboard";

import * as internalWorkflow from "../src/utils/internal-workflow";
import * as organizations from "../src/utils/organizations";

const organization = {
  id: "org_test",
  slug: "acme",
  name: "Acme",
  logo: null,
};

const dashboardResult = {
  branchName: "notra/blog-faster-exports",
  operation: "created" as const,
  path: "content/blog/faster-exports.md",
  pullRequestNumber: 42,
  pullRequestUrl: "https://github.com/acme/site/pull/42",
};

const callDashboardInternal = mock(
  async (_url: string, _payload: unknown): Promise<unknown> => dashboardResult
);

mock.module("../src/utils/internal-workflow", () => ({
  ...internalWorkflow,
  callDashboardInternal,
}));

// mock.module is process-wide in bun, and sites-routes.test.ts mocks this
// too, so pin the organization here instead of depending on file order.
mock.module("../src/utils/organizations", () => ({
  ...organizations,
  resolveRequestOrganization: async () => ({
    orgId: organization.id,
    organization,
  }),
}));

const logError = mock(() => undefined);

const { postsRoutes } = await import("../src/routes/posts");
const { createOpenApiApp } = await import("../src/utils/openapi-app");

type Integration = { id: string; owner: string; repo: string };

function createApp(integrations: Integration[]) {
  const db = {
    query: {
      organizations: { findFirst: mock(async () => organization) },
    },
    select: mock(() => ({
      from: () => ({ where: async () => integrations }),
    })),
  };
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", {
      keyId: "key_test",
      identity: { externalId: organization.id },
    } as never);
    c.set("db", db as never);
    c.set("log", { error: logError } as never);
    await next();
  });
  app.route("/", postsRoutes);
  return app;
}

const env = { WORKFLOW_BASE_URL: "https://dashboard.test/" };

function openPullRequest(
  app: ReturnType<typeof createApp>,
  body?: Record<string, unknown>,
  runtimeEnv: Record<string, string> = env
) {
  return app.request(
    "/posts/post_1/pull-request",
    {
      method: "POST",
      ...(body
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
    runtimeEnv
  );
}

const site = { id: "integration_site", owner: "acme", repo: "site" };
const docs = { id: "integration_docs", owner: "acme", repo: "docs" };

beforeEach(() => {
  callDashboardInternal.mockReset();
  callDashboardInternal.mockImplementation(async () => dashboardResult);
  logError.mockClear();
});

describe("POST /posts/{postId}/pull-request", () => {
  test("opens the draft through the dashboard publisher", async () => {
    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organization,
      pullRequest: {
        number: 42,
        url: "https://github.com/acme/site/pull/42",
        branchName: "notra/blog-faster-exports",
        path: "content/blog/faster-exports.md",
        operation: "created",
      },
    });
    expect(callDashboardInternal).toHaveBeenCalledTimes(1);
    const [url, payload] = callDashboardInternal.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://dashboard.test/api/internal/content/draft-pull-request"
    );
    expect(payload).toEqual({
      organizationId: organization.id,
      postId: "post_1",
      integrationId: site.id,
    });
  });

  test("picks a repository by owner and name", async () => {
    const response = await openPullRequest(createApp([docs, site]), {
      github: { owner: "ACME", repo: "Site" },
    });

    expect(response.status).toBe(200);
    expect(callDashboardInternal.mock.calls[0]?.[1]).toMatchObject({
      integrationId: site.id,
    });
  });

  test("uses the only connected repository when none is named", async () => {
    const response = await openPullRequest(createApp([site]));

    expect(response.status).toBe(200);
    expect(callDashboardInternal.mock.calls[0]?.[1]).toMatchObject({
      integrationId: site.id,
    });
  });

  test("asks for a repository when several are connected", async () => {
    const response = await openPullRequest(createApp([site, docs]), {});

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        "Several GitHub repositories are connected; pass integrationId or github to pick one",
    });
    expect(callDashboardInternal).not.toHaveBeenCalled();
  });

  test("rejects a repository that is not connected", async () => {
    const response = await openPullRequest(createApp([site]), {
      github: { owner: "acme", repo: "missing" },
    });

    expect(response.status).toBe(400);
    expect(callDashboardInternal).not.toHaveBeenCalled();
  });

  test("rejects both selectors at once", async () => {
    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
      github: { owner: "acme", repo: "site" },
    });

    expect(response.status).toBe(400);
    expect(callDashboardInternal).not.toHaveBeenCalled();
  });

  test("passes the dashboard's reason through for a missing post", async () => {
    callDashboardInternal.mockImplementation(async () => {
      throw new InternalDashboardError(
        404,
        null,
        JSON.stringify({ error: "Post not found" })
      );
    });

    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Post not found" });
  });

  test("reports the publisher's rate limit as temporarily unavailable", async () => {
    callDashboardInternal.mockImplementation(async () => {
      throw new InternalDashboardError(
        429,
        null,
        JSON.stringify({ error: "Too many GitHub publish requests" })
      );
    });

    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
    });

    expect(response.status).toBe(503);
  });

  test("says a timed out export may still complete", async () => {
    callDashboardInternal.mockImplementation(async () => {
      throw new InternalDashboardTimeoutError(150_000);
    });

    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
    });

    expect(response.status).toBe(504);
    expect(((await response.json()) as { error: string }).error).toContain(
      "may still complete"
    );
  });

  test("hides other dashboard failures behind a retryable 502", async () => {
    callDashboardInternal.mockImplementation(async () => {
      throw new InternalDashboardError(500, null, "boom");
    });

    const response = await openPullRequest(createApp([site]), {
      integrationId: site.id,
    });

    expect(response.status).toBe(502);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  test("is unavailable without the dashboard URL", async () => {
    const response = await openPullRequest(
      createApp([site]),
      { integrationId: site.id },
      {}
    );

    expect(response.status).toBe(503);
    expect(callDashboardInternal).not.toHaveBeenCalled();
  });
});
