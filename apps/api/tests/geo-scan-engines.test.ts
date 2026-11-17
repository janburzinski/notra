import { afterEach, describe, expect, mock, test } from "bun:test";

const organization = { id: "org_1", slug: "acme", name: "Acme", logo: null };

const runGeoEffect = mock(async (_name: string, _effect: unknown) => ({
  ok: true,
  value: { scanId: "scan_1" },
}));
const runtime = await import("../src/runtime/geo");
mock.module("../src/runtime/geo", () => ({ ...runtime, runGeoEffect }));

// The programs are lazy effects; returning the input shows what the route asked for.
const programs = await import("@notra/geo-core/geo/programs");
mock.module("@notra/geo-core/geo/programs", () => ({
  ...programs,
  startGeoScan: (input: unknown) => input,
  startGeoPromptRescan: (input: unknown) => input,
}));

const ratelimit = await import("../src/utils/ratelimit");
mock.module("../src/utils/ratelimit", () => ({
  ...ratelimit,
  enforceRatelimit: async () => null,
}));
const analytics = await import("../src/utils/analytics");
mock.module("../src/utils/analytics", () => ({
  ...analytics,
  trackApiEvent: () => undefined,
}));

const { geoScansRoutes } = await import("../src/routes/geo-scans");
const { createOpenApiApp } = await import("../src/utils/openapi-app");

function post(path: string, body?: unknown) {
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", { valid: true, keyId: "key_1" } as never);
    c.set("geo", { organizationId: organization.id, organization } as never);
    await next();
  });
  app.route("/v1", geoScansRoutes);
  return app.request(`/v1/projects/project_1/geo/scans${path}`, {
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

describe("scan triggers with an engine selection", () => {
  afterEach(() => {
    runGeoEffect.mockClear();
  });

  test("rescans one prompt on every tracked engine without a body", async () => {
    const response = await post("/prompts/prompt_1");

    expect(response.status).toBe(202);
    expect(runGeoEffect.mock.calls[0]?.[1]).toEqual({
      organizationId: organization.id,
      projectId: "project_1",
      promptId: "prompt_1",
      engines: undefined,
    });
  });

  test("rescans one prompt on only the engines asked for", async () => {
    const response = await post("/prompts/prompt_1", {
      engines: ["openai/chatgpt"],
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      scanId: "scan_1",
      statusUrl: "/v1/projects/project_1/geo/scans/scan_1",
    });
    expect(runGeoEffect.mock.calls[0]?.[1]).toMatchObject({
      promptId: "prompt_1",
      engines: ["openai/chatgpt"],
    });
  });

  test("scopes a full scan to the engines asked for", async () => {
    const response = await post("", {
      engines: ["openai/chatgpt", "google/gemini"],
    });

    expect(response.status).toBe(202);
    expect(runGeoEffect.mock.calls[0]?.[1]).toEqual({
      organizationId: organization.id,
      projectId: "project_1",
      engines: ["openai/chatgpt", "google/gemini"],
    });
  });

  test("turns down an empty engine list before starting anything", async () => {
    const response = await post("/prompts/prompt_1", { engines: [] });

    expect(response.status).toBe(400);
    expect(runGeoEffect).not.toHaveBeenCalled();
  });
});
