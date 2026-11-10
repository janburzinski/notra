import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LEGACY_API_WRITE_SCOPE } from "@notra/utils/api-scopes";

const organization = { id: "org_1", slug: "acme", name: "Acme", logo: null };
const project = {
  id: "project_1",
  name: "Acme",
  brandSettingsId: "brand_1",
  createdAt: "2026-11-10T00:00:00.000Z",
};

const runGeoEffect = mock(async () => ({ ok: true, value: { project } }));
const runtime = await import("../src/runtime/geo");
mock.module("../src/runtime/geo", () => ({ ...runtime, runGeoEffect }));

const { geoProjectsRoutes } = await import("../src/routes/geo-projects");
const { createOpenApiApp } = await import("../src/utils/openapi-app");

const identity = { externalId: organization.id };
const oauth = (scopes: string[]) => ({
  type: "oauth",
  keyId: "oauth_1",
  userId: "user_1",
  scopes,
  identity,
});
const apiKey = (permissions?: string[]) => ({
  valid: true,
  keyId: "key_1",
  identity,
  ...(permissions ? { permissions } : {}),
});

function createProject(auth: unknown, body: Record<string, unknown>) {
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", auth as never);
    c.set("geo", { organizationId: organization.id, organization } as never);
    await next();
  });
  app.route("/v1", geoProjectsRoutes);
  return app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const START = { name: "Acme", startScan: true };
const FULL = ["projects.write", "scans.write", "geo-settings.write"];

describe("POST /v1/projects startScan", () => {
  beforeEach(() => {
    runGeoEffect.mockClear();
  });

  test.each([
    ["an OAuth token", oauth(["projects.write"])],
    ["an API key", apiKey(["projects.write", "scans.write"])],
    ["an API key without a permission list", apiKey()],
  ])("refuses to scan with %s that lacks the scopes", async (_, auth) => {
    const response = await createProject(auth, START);

    expect(response.status).toBe(403);
    expect(runGeoEffect).not.toHaveBeenCalled();
  });

  test.each([
    ["an OAuth token", oauth(FULL)],
    ["an API key", apiKey(FULL)],
    ["a legacy write key", apiKey([LEGACY_API_WRITE_SCOPE])],
  ])("starts with %s that has the scopes", async (_, auth) => {
    const response = await createProject(auth, START);

    expect(response.status).toBe(201);
    expect(runGeoEffect).toHaveBeenCalledTimes(1);
  });

  test("needs only projects.write when scans stay off", async () => {
    const response = await createProject(oauth(["projects.write"]), {
      name: "Acme",
    });

    expect(response.status).toBe(201);
  });
});
