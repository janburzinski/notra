import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@notra/ai/qstash/triggers", () => ({
  getBaseUrl: () => "https://dashboard.test",
}));

const { default: scanGeoPrompt } =
  await import("../agent/tools/scan_geo_prompt");
const { default: findGeoPrompts } =
  await import("../agent/tools/find_geo_prompts");

type ScanTool = {
  approval: (ctx: unknown) => unknown;
  execute: (input: unknown, ctx: unknown) => Promise<unknown>;
};
const tool = scanGeoPrompt as unknown as ScanTool;

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

describe("scan_geo_prompt", () => {
  test("asks the person first, and never scans from a background task", () => {
    expect(tool.approval(context("chat"))).toBe("user-approval");
    expect(tool.approval(context("task"))).toMatchObject({ type: "denied" });
  });

  test("hands the prompt and engines to the dashboard for this workspace", async () => {
    respond(200, {
      status: "started",
      scanId: "scan_1",
      promptId: "p1",
      prompt: "Best issue tracker for startups",
    });

    const result = await tool.execute(
      { prompt: "issue tracker", engines: ["openai/chatgpt"] },
      context("chat")
    );

    expect(result).toEqual({
      status: "started",
      scanId: "scan_1",
      promptId: "p1",
      prompt: "Best issue tracker for startups",
    });
    const [request] = requests;
    if (!request) {
      throw new Error("The tool sent no request");
    }
    expect(request.url).toBe(
      "https://dashboard.test/api/internal/geo/prompt-scan"
    );
    expect(new Headers(request.init.headers).get("authorization")).toBe(
      "Bearer secret_fixture"
    );
    expect(JSON.parse(String(request.init.body))).toEqual({
      organizationId: "org_1",
      prompt: "issue tracker",
      engines: ["openai/chatgpt"],
    });
  });

  test("passes prompts to choose from back to the model", async () => {
    const choose = {
      status: "choose",
      prompts: [
        { id: "p2", prompt: "Which tools track issues?" },
        { id: "p3", prompt: "Best issue tracker for startups" },
      ],
    };
    respond(200, choose);

    expect(await tool.execute({ prompt: "track" }, context("chat"))).toEqual(
      choose
    );
  });

  test("returns the dashboard's reason when the scan can't start", async () => {
    respond(400, { error: "Unknown engines: acme/nope." });

    expect(
      await tool.execute(
        { prompt: "p1", engines: ["acme/nope"] },
        context("chat")
      )
    ).toBe("Unknown engines: acme/nope.");
  });
});

describe("find_geo_prompts", () => {
  test("lists matching prompts without asking for approval", async () => {
    const found = {
      prompts: [{ id: "p1", prompt: "Best issue tracker" }],
      total: 1,
    };
    respond(200, found);
    const finder = findGeoPrompts as unknown as Partial<ScanTool>;

    expect(finder.approval).toBeUndefined();
    expect(
      await finder.execute?.({ query: "issue tracker" }, context("chat"))
    ).toEqual(found);
    expect(requests[0]?.url).toBe(
      "https://dashboard.test/api/internal/geo/prompt-find"
    );
  });
});
