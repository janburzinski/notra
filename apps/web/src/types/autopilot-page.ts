import type { IconSvgElement } from "@hugeicons/react";

export type AutopilotOutputLogo = "slack" | "github" | "email";

export type AutopilotPartnerLogo =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "google"
  | "github"
  | "slack";

export type AutopilotStepState = "queued" | "running" | "done";

interface AutopilotWorkflowStep {
  title: string;
  detail: string;
  result: string;
  icon: IconSvgElement;
  /** Shows the brand's own logo instead of the line icon. */
  brand?: "slack";
}

export interface AutopilotStageScenario {
  goal: string;
  steps: readonly AutopilotWorkflowStep[];
}

export interface AutopilotOutput {
  label: string;
  logo: AutopilotOutputLogo;
}

export interface AutopilotPartner {
  label: string;
  logo: AutopilotPartnerLogo;
}
