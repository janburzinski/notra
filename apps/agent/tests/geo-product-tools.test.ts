import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@notra/ai/qstash/triggers", () => ({
  getBaseUrl: () => "https://dashboard.test",
}));

const { default: createGeoProduct } =
  await import("../agent/tools/create_geo_product");
const { default: moveGeoPrompts } =
  await import("../agent/tools/move_geo_prompts");
const { default: updateGeoProduct } =
  await import("../agent/tools/update_geo_product");
const { default: deleteGeoProduct } =
  await import("../agent/tools/delete_geo_product");

type AgentTool = {
  approval: (ctx: unknown) => unknown;
  execute: (input: unknown, ctx: unknown) => Promise<unknown>;
};
const create = createGeoProduct as unknown as AgentTool;
const move = moveGeoPrompts as unknown as AgentTool;
const update = updateGeoProduct as unknown as AgentTool;
const remove = deleteGeoProduct as unknown as AgentTool;

function context(surface: string) {
  const auth = {
    authenticator: "eve",
    principalId: "user_1",
    attributes: { organizationId: "org_1", surface },
  };
  return { session: { auth: { current: auth, initiator: auth } } };
}

const originalFetch = globalThis.fetch;
const originalSecret = process.env.INTERNAL_WORKFLOW_SECRET;
const requests: { url: string; init: RequestInit }[] = [];

function respond(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return Response.json(body, { status });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.INTERNAL_WORKFLOW_SECRET = "secret_fixture";
  requests.length = 0;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.INTERNAL_WORKFLOW_SECRET = originalSecret;
});

describe("GEO product tools", () => {
  test("run without a prompt in chat, and never from a background task", () => {
    for (const tool of [create, move, update]) {
      expect(tool.approval(context("chat"))).toBe("not-applicable");
      expect(tool.approval(context("task"))).toMatchObject({ type: "denied" });
    }
  });

  test("delete_geo_product asks the person first, and never runs from a background task", () => {
    expect(remove.approval(context("chat"))).toBe("user-approval");
    expect(remove.approval(context("task"))).toMatchObject({ type: "denied" });
  });

  test("delete_geo_product hands the product name to the dashboard", async () => {
    respond(200, {
      status: "deleted",
      product: "Notes",
      unfiledPrompts: 2,
      refiledPrompts: 1,
    });

    const result = await remove.execute({ product: "Notes" }, context("chat"));

    expect(result).toMatchObject({ status: "deleted", refiledPrompts: 1 });
    expect(requests[0]?.url).toBe(
      "https://dashboard.test/api/internal/geo/product-delete"
    );
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      organizationId: "org_1",
      product: "Notes",
    });
  });

  test("create_geo_product hands the name to the dashboard for this workspace", async () => {
    respond(200, {
      status: "created",
      product: { id: "prod_1", name: "Team plan", niche: null },
      sortedPrompts: 3,
    });

    const result = await create.execute({ name: "Team plan" }, context("chat"));

    expect(result).toMatchObject({ status: "created", sortedPrompts: 3 });
    const [request] = requests;
    expect(request?.url).toBe(
      "https://dashboard.test/api/internal/geo/product-create"
    );
    expect(JSON.parse(String(request?.init.body))).toEqual({
      organizationId: "org_1",
      name: "Team plan",
    });
  });

  test("move_geo_prompts passes unknown product names back with the project's products", async () => {
    respond(200, {
      status: "error",
      error: 'The project has no product named "Teams".',
      products: ["Launcher", "Team plan"],
    });

    const result = await move.execute(
      { prompts: ["p1"], product: "Teams" },
      context("chat")
    );

    expect(result).toMatchObject({ products: ["Launcher", "Team plan"] });
    expect(requests[0]?.url).toBe(
      "https://dashboard.test/api/internal/geo/prompts-move"
    );
  });
});
