import type { PromptCalculatorFrequencyId } from "@/types/landing/prompt-calculator";

export const PROMPT_CALCULATOR_PARAMS = {
  prompts: "prompts",
  models: "models",
  frequency: "frequency",
} as const;

export const PROMPT_CALCULATOR_ANCHOR = "calculator";

export const PROMPT_CALCULATOR_ENGINE_IDS = [
  "chatgpt",
  "claude",
  "ai-overview",
  "gemini",
  "ai-mode",
] as const;

export const PROMPT_CALCULATOR_FREQUENCIES = [
  { id: "daily", intervalDays: 1 },
  { id: "every-2-days", intervalDays: 2 },
  { id: "every-3-days", intervalDays: 3 },
  { id: "weekly", intervalDays: 7 },
  { id: "every-2-weeks", intervalDays: 14 },
  { id: "monthly", intervalDays: 30 },
] as const;

export const PROMPT_CALCULATOR_DAYS_PER_MONTH = 30;

export const PROMPT_CALCULATOR_MIN_PROMPTS = 1;
export const PROMPT_CALCULATOR_MAX_PROMPTS = 10_000;

export const PROMPT_CALCULATOR_DEFAULT_PROMPTS = 10;
export const PROMPT_CALCULATOR_DEFAULT_MODELS: string[] = [
  "openai/chatgpt",
  "google/ai-overview",
  "google/gemini",
];
export const PROMPT_CALCULATOR_DEFAULT_FREQUENCY: PromptCalculatorFrequencyId =
  "daily";

export const PROMPT_CALCULATOR_STOPS = [
  5, 10, 25, 50, 100, 150, 250, 500, 1000,
] as const;

export const PROMPT_CALCULATOR_MILESTONES = [
  { prompts: 5, id: "spotCheck" },
  { prompts: 25, id: "coreQuestions" },
  { prompts: 100, id: "category" },
  { prompts: 250, id: "markets" },
  { prompts: 1000, id: "everyAngle" },
] as const;
