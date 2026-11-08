import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Gemini } from "@notra/ui/components/ui/svgs/gemini";
import { Google } from "@notra/ui/components/ui/svgs/google";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { OpenaiDark } from "@notra/ui/components/ui/svgs/openaiDark";

import type { PromptCalculatorEngine } from "@/types/landing/prompt-calculator";

export const PROMPT_CALCULATOR_ENGINES: PromptCalculatorEngine[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    featured: true,
    icon: Openai,
    darkIcon: OpenaiDark,
    defaultModel: "openai/chatgpt",
    models: [{ id: "openai/chatgpt", label: "ChatGPT" }],
  },
  {
    id: "claude",
    name: "Claude",
    featured: true,
    icon: ClaudeAiIcon,
    defaultModel: "anthropic/claude-haiku-5.5",
    models: [{ id: "anthropic/claude-haiku-5.5", label: "Claude" }],
  },
  {
    id: "ai-overview",
    name: "Google AI Overviews",
    featured: true,
    icon: Google,
    defaultModel: "google/ai-overview",
    models: [{ id: "google/ai-overview", label: "AI Overviews" }],
  },
  {
    id: "gemini",
    name: "Gemini",
    featured: true,
    icon: Gemini,
    defaultModel: "google/gemini",
    models: [{ id: "google/gemini", label: "Gemini" }],
  },
  {
    id: "ai-mode",
    name: "Google AI Mode",
    featured: false,
    icon: Google,
    defaultModel: "google/ai-mode",
    models: [{ id: "google/ai-mode", label: "AI Mode" }],
  },
];

export const PROMPT_CALCULATOR_MODEL_IDS: string[] =
  PROMPT_CALCULATOR_ENGINES.flatMap((engine) =>
    engine.models.map((model) => model.id)
  );
