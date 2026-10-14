export const CODING_AGENT_TARGETS = [
  ["opencode/gpt-5.6-sol-medium", undefined],
  ["claude-code/claude-fable-5.1", "claude-code"],
  ["claude-code/claude-opus-5", "claude-code"],
  ["codex/gpt-6-astra", "codex"],
  ["codex/gpt-5.6-sol-rei", "codex"],
] as const;

export const CODING_AGENT_USAGE = {
  modelId: "openai/gpt-5.6-sol",
  inputTokens: 100,
  inputTokenDetails: {
    noCacheTokens: 70,
    cacheReadTokens: 20,
    cacheWriteTokens: 10,
  },
  outputTokens: 40,
  outputTokenDetails: { textTokens: 25, reasoningTokens: 15 },
  totalTokens: 140,
  totalUsd: 0.25,
  computeMs: 1200,
};
