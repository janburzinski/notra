import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  InternalDashboardError,
  InternalDashboardTimeoutError,
} from "@notra/schemas/api/internal-dashboard";

const organization = { id: "org_1", slug: "acme", name: "Acme", logo: null };
const callDashboardInternal = mock(
  async (
    _url: string,
    _payload: unknown,
    _schema: unknown,
    _timeout?: number
  ) => ({}) as unknown
);

const internalWorkflow = await import("../src/utils/internal-workflow");
const organizations = await import("../src/utils/organizations");
mock.module("../src/utils/internal-workflow", () => ({
  ...internalWorkflow,
  callDashboardInternal,
  getInternalWorkflowUrl: (_env: unknown, path: string) =>
    `https://dashboard.test${path}`,
}));
mock.module("../src/utils/organizations", () => ({
  ...organizations,
  resolveRequestOrganization: async () => ({
    orgId: organization.id,
    organization,
  }),
}));

const { sitesRoutes } = await import("../src/routes/sites");
const { createOpenApiApp } = await import("../src/utils/openapi-app");

function createApp(auth: Record<string, unknown>) {
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", auth as never);
    await next();
  });
  app.route("/v1", sitesRoutes);
  return app;
}

const orgKey = { keyId: "key_1", identity: { externalId: organization.id } };
const oauth = {
  type: "oauth",
  keyId: "oauth_1",
  userId: "user_1",
  scopes: [],
  identity: { externalId: organization.id },
};

describe("Sites API routes", () => {
  beforeEach(() => {
    callDashboardInternal.mockReset();
  });

  test("scopes the dashboard call to the workspace and actor", async () => {
    callDashboardInternal.mockResolvedValue({ deployments: [] });
    const response = await createApp(orgKey).request(
      "/v1/sites/site_1/deployments?limit=5"
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organization, deployments: [] });
    expect(callDashboardInternal.mock.calls[0]?.[0]).toBe(
      "https://dashboard.test/api/internal/sites/api"
    );
    expect(callDashboardInternal.mock.calls[0]?.[1]).toEqual({
      action: "listDeployments",
      organizationId: organization.id,
      actorUserId: null,
      siteId: "site_1",
      limit: 5,
    });

    callDashboardInternal.mockResolvedValue({ preview: null });
    await createApp(oauth).request("/v1/sites/site_1/post-previews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: "post_1" }),
    });
    expect(callDashboardInternal.mock.calls[1]?.[1]).toEqual({
      action: "previewPost",
      organizationId: organization.id,
      actorUserId: "user_1",
      siteId: "site_1",
      postId: "post_1",
      lifetime: "1d",
    });
  });

  test("rejects invalid input before calling the dashboard", async () => {
    const response = await createApp(orgKey).request(
      "/v1/sites/site_1/post-previews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: "post_1", password: "short" }),
      }
    );

    expect(response.status).toBe(400);
    expect(callDashboardInternal).not.toHaveBeenCalled();
  });

  test("forwards client errors and hides server failures", async () => {
    callDashboardInternal.mockRejectedValueOnce(
      new InternalDashboardError(
        404,
        null,
        JSON.stringify({ error: "Site not found" })
      )
    );
    const missing = await createApp(orgKey).request("/v1/sites/site_x");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Site not found" });

    callDashboardInternal.mockRejectedValueOnce(
      new InternalDashboardError(500, null, "database password in stack")
    );
    const failed = await createApp(orgKey).request(
      "/v1/sites/site_1/deployments"
    );
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Sites request failed" });

    callDashboardInternal.mockRejectedValueOnce(
      new InternalDashboardTimeoutError(60_000)
    );
    const slow = await createApp(orgKey).request(
      "/v1/sites/site_1/publications",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: "post_1" }),
      }
    );
    expect(slow.status).toBe(504);
  });
});
