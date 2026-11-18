import { afterEach, describe, expect, mock, test } from "bun:test";

import type { GeoOutcome } from "../src/types/geo";

const organization = { id: "org_1", slug: "acme", name: "Acme", logo: null };

const scanStarted = { ok: true, value: { scanId: "scan_1" } } as const;
const runGeoEffect = mock(
  async (
    _name: string,
    _effect: unknown
  ): Promise<GeoOutcome<{ scanId: string }>> => scanStarted
);
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
    runGeoEffect.mockResolvedValue(scanStarted);
  });

  test("rescans one prompt on every tracked engine without a body", async () => {
    const response = await post("/prompts/prompt_1");

    expect(response.status).toBe(202);
    expect(runGeoEffect.mock.calls[0]?.[1]).toEqual({
      organizationId: organization.id,
      projectId: "project_1",
      promptId: "prompt_1",
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

  test("forwards a one-shot scan without sequences", async () => {
    const response = await post("", { oneShot: true, includeSequences: false });

    expect(response.status).toBe(202);
    expect(runGeoEffect.mock.calls[0]?.[1]).toEqual({
      organizationId: organization.id,
      projectId: "project_1",
      oneShot: true,
      includeSequences: false,
    });
  });

  test("forwards a one-shot prompt rescan", async () => {
    const response = await post("/prompts/prompt_1", { oneShot: true });

    expect(response.status).toBe(202);
    expect(runGeoEffect.mock.calls[0]?.[1]).toMatchObject({
      promptId: "prompt_1",
      oneShot: true,
    });
  });

  test("turns down an empty engine list before starting anything", async () => {
    const response = await post("/prompts/prompt_1", { engines: [] });

    expect(response.status).toBe(400);
    expect(runGeoEffect).not.toHaveBeenCalled();
  });

  test("returns a machine-readable code and message for a rejected trigger", async () => {
    const failure = {
      status: 400,
      code: "GEO_TRACKING_DISABLED",
      error: "Tracking is disabled",
    } as const;
    runGeoEffect.mockResolvedValueOnce({ ok: false, failure });

    const response = await post("");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: failure.code,
      error: failure.error,
    });
  });
});
