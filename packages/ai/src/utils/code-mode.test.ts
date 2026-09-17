import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CODE_MODE_SEARCH_TOOL_NAME,
  CODE_MODE_TOOL_NAME,
  STANDALONE_CODE_MODE_TOOL_NAMES,
} from "@notra/ai/constants/code-mode";
import {
  buildStandaloneToolSet,
  getStandaloneApprovalToolNames,
} from "@notra/ai/orchestration/standalone-tool-registry";
import { generateText, isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { withStandaloneCodeMode } from "./code-mode";

const ORGANIZATION_ID = "org_code_mode_test";

// Tools that write data, need approval, or render in the chat UI (charts, post
// cards, brand favicons) must stay directly callable. A new standalone tool
// has to be added here or to STANDALONE_CODE_MODE_TOOL_NAMES.
const DIRECT_TOOL_NAMES = [
  "addBrandReference",
  "createBlogPost",
  "createChangelog",
  "createImage",
  "createInvestorUpdate",
  "createLinkedInPost",
  "createSkill",
  "createTwitterPost",
  "getBrandIdentity",
  "getGeoCompetitorShare",
  "getGeoOverview",
  "getGeoTimeseries",
  "listBrandIdentities",
  "updatePost",
];

function buildFullStandaloneRegistry() {
  return buildStandaloneToolSet({
    organizationId: ORGANIZATION_ID,
    chatId: "chat_code_mode_test",
    userId: "user_code_mode_test",
    validatedIntegrations: [
      {
        id: "github_integration",
        type: "github",
        enabled: true,
        displayName: "GitHub",
        organizationId: ORGANIZATION_ID,
        repositories: [
          {
            id: "repository",
            owner: "usenotra",
            repo: "notra",
            defaultBranch: "main",
            enabled: true,
          },
        ],
      },
      {
        id: "linear_integration",
        type: "linear",
        enabled: true,
        displayName: "Linear",
        organizationId: ORGANIZATION_ID,
      },
      {
        id: "granola_integration",
        type: "granola",
        enabled: true,
        displayName: "Granola",
        organizationId: ORGANIZATION_ID,
      },
    ],
    postResult: {},
  }).tools;
}

function sortedNames(names: Iterable<string>) {
  return [...names].sort();
}

function textOnlyModel() {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: "ok" }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

function serializedPromptMessages(
  model: MockLanguageModelV4,
  callIndex: number
) {
  return JSON.stringify(model.doGenerateCalls[callIndex]?.prompt ?? []);
}

describe("standalone code mode policy", () => {
  test("classifies every standalone tool as code mode or direct", () => {
    const registryToolNames = Object.keys(buildFullStandaloneRegistry());

    assert.deepEqual(
      sortedNames(registryToolNames),
      sortedNames([...STANDALONE_CODE_MODE_TOOL_NAMES, ...DIRECT_TOOL_NAMES])
    );
  });

  test("keeps approval tools out of code mode", () => {
    const codeModeToolNames = new Set<string>(STANDALONE_CODE_MODE_TOOL_NAMES);

    for (const toolName of getStandaloneApprovalToolNames()) {
      assert.equal(codeModeToolNames.has(toolName), false, toolName);
    }
  });

  test("sends only direct tools, code_mode, and search to the model", async () => {
    const { tools, toolCallers } = withStandaloneCodeMode(
      buildFullStandaloneRegistry()
    );
    const model = textOnlyModel();

    await generateText({
      model,
      prompt: "Which tools can you use?",
      tools,
      experimental_toolCallers: toolCallers,
    });

    const modelTools = (model.doGenerateCalls[0]?.tools ?? []).filter(
      (modelTool) => modelTool.type === "function"
    );
    assert.deepEqual(
      sortedNames(modelTools.map((modelTool) => modelTool.name)),
      sortedNames([
        ...DIRECT_TOOL_NAMES,
        CODE_MODE_TOOL_NAME,
        CODE_MODE_SEARCH_TOOL_NAME,
      ])
    );

    // Deferred tool signatures stay out of the code_mode description; the
    // initial capability update announces only the search tool.
    const codeModeDescription =
      modelTools.find((modelTool) => modelTool.name === CODE_MODE_TOOL_NAME)
        ?.description ?? "";
    for (const toolName of STANDALONE_CODE_MODE_TOOL_NAMES) {
      assert.equal(
        codeModeDescription.includes(`${toolName}:`),
        false,
        toolName
      );
    }

    const promptMessages = serializedPromptMessages(model, 0);
    assert.ok(promptMessages.includes("Code mode capability update"));
    assert.ok(promptMessages.includes(CODE_MODE_SEARCH_TOOL_NAME));
    for (const toolName of STANDALONE_CODE_MODE_TOOL_NAMES) {
      assert.equal(promptMessages.includes(`${toolName}:`), false, toolName);
    }
  });

  test("search discovers deferred tools for the next model step", async () => {
    const { tools, toolCallers } = withStandaloneCodeMode(
      buildFullStandaloneRegistry()
    );
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [
            {
              type: "tool-call",
              toolCallId: "call_search",
              toolName: CODE_MODE_SEARCH_TOOL_NAME,
              input: JSON.stringify({ query: "pull requests" }),
            },
          ],
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
        },
        {
          content: [{ type: "text", text: "found them" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
        },
      ],
    });

    await generateText({
      model,
      prompt: "List my open pull requests",
      tools,
      experimental_toolCallers: toolCallers,
      stopWhen: isStepCount(5),
    });

    assert.equal(model.doGenerateCalls.length, 2);
    const stepOnePrompt = serializedPromptMessages(model, 0);
    assert.equal(stepOnePrompt.includes("getPullRequests"), false);
    const stepTwoPrompt = serializedPromptMessages(model, 1);
    assert.ok(stepTwoPrompt.includes("Code mode capability update"));
    assert.ok(stepTwoPrompt.includes("getPullRequests"));
  });
});
