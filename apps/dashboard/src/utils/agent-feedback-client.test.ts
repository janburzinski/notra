import { describe, expect, test } from "bun:test";

import {
  formatAgentFeedbackClient,
  resolveAgentFeedbackClientBrand,
} from "@/utils/agent-feedback-client";

describe("formatAgentFeedbackClient", () => {
  test("names well-known MCP client IDs by their product", () => {
    expect(formatAgentFeedbackClient("cursor-vscode")).toBe("Cursor");
    expect(formatAgentFeedbackClient("openai-mcp")).toBe("ChatGPT");
    expect(formatAgentFeedbackClient("codex-mcp-client")).toBe("Codex");
  });

  test("title-cases other slugs and keeps names that have their own casing", () => {
    expect(formatAgentFeedbackClient("claude-code")).toBe("Claude Code");
    expect(formatAgentFeedbackClient("notra-mcp")).toBe("Notra MCP");
    expect(formatAgentFeedbackClient("Visual Studio Code")).toBe(
      "Visual Studio Code"
    );
  });
});

describe("resolveAgentFeedbackClientBrand", () => {
  test("gives Codex the OpenAI mark", () => {
    expect(resolveAgentFeedbackClientBrand("codex-mcp-client")).toBe("openai");
  });
});
