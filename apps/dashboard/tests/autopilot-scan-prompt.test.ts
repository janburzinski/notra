import { afterEach, describe, expect, mock, test } from "bun:test";

import type { WorkflowBlockStepContext } from "@notra/workflows/types/blocks";

import type { AutopilotPromptScanStart } from "@/types/autopilot-workflows";

const startAutopilotPromptScan = mock(
  async (_params: unknown): Promise<AutopilotPromptScanStart> => ({
    ok: true,
    scanId: "scan_1",
    prompt: "best crm for startups",
  })
);
const collectAutopilotPromptScan = mock(
  async (_params: unknown): Promise<Record<string, unknown> | null> => null
);
const scanPrompt = await import("@/lib/autopilot/workflows/scan-prompt");
mock.module("@/lib/autopilot/workflows/scan-prompt", () => ({
  ...scanPrompt,
  startAutopilotPromptScan,
  collectAutopilotPromptScan,
}));

const { customAutopilotBlocks } =
  await import("@/lib/workflow-engine/blocks/autopilot/custom");
const { AUTOPILOT_WORKFLOW_BLOCK_TYPES } =
  await import("@/constants/autopilot-workflows");
const { findAutopilotWorkflowMistakes } =
  await import("@/utils/autopilot-workflows");
const { describeAutopilotPromptScanFailure, summarizeAutopilotPromptScan } =
  await import("@/utils/autopilot-scan-prompt");
const { GeoScanEnginesUnknownError } =
  await import("@notra/geo-core/geo/errors");

const block = customAutopilotBlocks.find(
  (candidate) => candidate.type === AUTOPILOT_WORKFLOW_BLOCK_TYPES.scanPrompt
);
if (!block) {
  throw new Error("The scan prompt step isn't registered");
}

function context(
  config: Record<string, unknown>,
  state: Record<string, unknown> = {}
): WorkflowBlockStepContext<unknown> {
  return {
    organizationId: "org_1",
    runId: "run_1",
    node: {
      id: "scan",
      type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.scanPrompt,
      title: "Ask ChatGPT again",
    } as WorkflowBlockStepContext<unknown>["node"],
    config,
    state,
    lastAttempt: false,
    idempotencyKey: "key_1",
  };
}

afterEach(() => {
  startAutopilotPromptScan.mockClear();
  collectAutopilotPromptScan.mockClear();
});

describe("scan a prompt step", () => {
  test("starts the prompt on just the engines the step names", async () => {
    const result = await block.runStep(
      0,
      context({ promptId: "prompt_1", engines: ["openai/chatgpt"] })
    );

    expect(startAutopilotPromptScan).toHaveBeenCalledWith({
      organizationId: "org_1",
      projectId: undefined,
      promptId: "prompt_1",
      engines: ["openai/chatgpt"],
    });
    expect(result).toEqual({
      status: "next",
      state: { scanId: "scan_1", prompt: "best crm for startups" },
    });
  });

  test("stops its branch while another scan holds the project", async () => {
    startAutopilotPromptScan.mockResolvedValueOnce({
      ok: false,
      reason: "Another scan is running",
      outcome: "halt",
    });

    expect(await block.runStep(0, context({ promptId: "p" }))).toEqual({
      status: "halted",
      reason: "Another scan is running",
      output: undefined,
    });
  });

  test("fails the run without retrying when an engine is unknown", async () => {
    startAutopilotPromptScan.mockResolvedValueOnce(
      describeAutopilotPromptScanFailure(
        new GeoScanEnginesUnknownError({
          projectId: "project_1",
          engines: ["acme/nope"],
          message: "Unknown engines: acme/nope.",
        }),
        "p"
      )
    );

    const error = await block
      .runStep(0, context({ promptId: "p", engines: ["acme/nope"] }))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe("FatalError");
    expect((error as Error).message).toBe("Unknown engines: acme/nope.");
  });

  test("hands on the answers once the scan settled", async () => {
    const scan = {
      scanId: "scan_1",
      status: "completed",
      finished: true,
      checks: 1,
      summary: "For x, 1 of 1 engines mentioned you.",
    };
    collectAutopilotPromptScan.mockResolvedValueOnce(scan);

    const result = await block.runStep(
      1,
      context({ promptId: "p" }, { scanId: "scan_1", prompt: "x" })
    );

    expect(collectAutopilotPromptScan).toHaveBeenCalledWith({
      organizationId: "org_1",
      scanId: "scan_1",
      prompt: "x",
    });
    expect(result).toEqual({ status: "success", output: scan });
  });

  test("fails the run when the scan failed without any answer", async () => {
    collectAutopilotPromptScan.mockResolvedValueOnce({
      status: "failed",
      checks: 0,
      summary: 'The scan of "x" failed: Engines failed',
    });

    await expect(
      block.runStep(
        1,
        context({ promptId: "p" }, { scanId: "scan_1", prompt: "x" })
      )
    ).rejects.toThrow('The scan of "x" failed: Engines failed');
  });

  test("lets later steps read only the fields it outputs", () => {
    const nodes = [
      { id: "start", type: "core.trigger", title: "When you run it" },
      {
        id: "scan",
        type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.scanPrompt,
        title: "Ask ChatGPT again",
        config: { promptId: "p", engines: ["openai/chatgpt"] },
      },
      {
        id: "slack",
        type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack,
        title: "Post it",
        config: {
          message:
            "{{nodes.scan.output.summary}} {{nodes.scan.output.visibility}}",
        },
      },
    ];
    expect(
      findAutopilotWorkflowMistakes({
        nodes,
        edges: [{ source: "start" }, { source: "scan" }],
      })
    ).toEqual([
      '"Post it" reads "visibility" from "Ask ChatGPT again", which only outputs scanId, status, finished, prompt, engines, checks, mentions, mentionRate, results, summary.',
    ]);
  });
});

describe("prompt scan summary", () => {
  test("names each engine's best rank across languages and who is still out", () => {
    expect(
      summarizeAutopilotPromptScan({
        prompt: "best crm",
        status: "running",
        errorMessage: null,
        engines: ["google/gemini", "openai/chatgpt", "perplexity/sonar"],
        results: [
          {
            engine: "openai/chatgpt",
            language: "English",
            mentioned: true,
            position: 3,
            competitors: [],
            excerpt: "",
          },
          {
            engine: "openai/chatgpt",
            language: "German",
            mentioned: true,
            position: 1,
            competitors: [],
            excerpt: "",
          },
          {
            engine: "google/gemini",
            language: "English",
            mentioned: false,
            position: null,
            competitors: ["Acme"],
            excerpt: "",
          },
        ],
      })
    ).toBe(
      'For "best crm", 1 of 2 engines mentioned you: openai/chatgpt (#1). Not mentioned by google/gemini. Still waiting on perplexity/sonar after 4 minutes; their answers show up in AI visibility when they finish.'
    );
  });

  test("reads naturally for a single engine", () => {
    const answer = {
      engine: "google/ai-overview",
      language: "English",
      position: 1,
      competitors: [],
      excerpt: "",
    };
    const summary = (mentioned: boolean) =>
      summarizeAutopilotPromptScan({
        prompt: "best crm",
        status: "completed",
        errorMessage: null,
        engines: ["google/ai-overview"],
        results: [{ ...answer, mentioned }],
      });
    expect(summary(true)).toBe(
      'For "best crm", google/ai-overview (#1) mentioned you.'
    );
    expect(summary(false)).toBe(
      'For "best crm", google/ai-overview didn\'t mention you.'
    );
  });

  test("keeps an unranked mention when another language missed", () => {
    const row = {
      engine: "google/gemini",
      position: null,
      competitors: [],
      excerpt: "",
    };
    expect(
      summarizeAutopilotPromptScan({
        prompt: "best crm",
        status: "completed",
        errorMessage: null,
        engines: ["google/gemini"],
        results: [
          { ...row, language: "English", mentioned: true },
          { ...row, language: "German", mentioned: false },
        ],
      })
    ).toBe('For "best crm", google/gemini mentioned you.');
  });
});
