const GEO_CLAUDE_ENGINE_ID = "anthropic/claude-haiku-5.5";
const GEO_KIMI_ENGINE_ID = "moonshotai/kimi-k2";
const GEO_GLM_ENGINE_ID = "zai/glm-5.3-flash";
const GEO_DEEPSEEK_ENGINE_ID = "deepseek/deepseek-v4-flash";
const GEO_GROK_ENGINE_ID = "spacexai/grok-4.20-non-reasoning";

export const GEO_SELF_SERVE_ENGINE_IDS: ReadonlySet<string> = new Set([
  "openai/chatgpt",
  "google/ai-overview",
  "google/gemini",
  "google/ai-mode",
  "perplexity/perplexity",
  "microsoft/copilot",
  GEO_CLAUDE_ENGINE_ID,
  GEO_KIMI_ENGINE_ID,
  GEO_GLM_ENGINE_ID,
  GEO_DEEPSEEK_ENGINE_ID,
  GEO_GROK_ENGINE_ID,
]);

export const GEO_ENGINE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  [GEO_CLAUDE_ENGINE_ID]: "Claude",
  [GEO_KIMI_ENGINE_ID]: "Kimi",
  [GEO_GLM_ENGINE_ID]: "GLM",
  [GEO_DEEPSEEK_ENGINE_ID]: "DeepSeek",
  [GEO_GROK_ENGINE_ID]: "Grok",
};

export const GEO_ENGINE_POLICY_FAMILY_REPLACEMENTS: readonly (readonly [
  prefix: string,
  replacement: string,
])[] = [
  ["openai/", "openai/chatgpt"],
  ["google/", "google/gemini"],
  ["anthropic/", GEO_CLAUDE_ENGINE_ID],
  ["claude-code/", GEO_CLAUDE_ENGINE_ID],
  ["codex/", "openai/chatgpt"],
  ["opencode/", "openai/chatgpt"],
  ["moonshotai/", GEO_KIMI_ENGINE_ID],
  ["zai/", GEO_GLM_ENGINE_ID],
  ["deepseek/", GEO_DEEPSEEK_ENGINE_ID],
  ["spacexai/", GEO_GROK_ENGINE_ID],
];
