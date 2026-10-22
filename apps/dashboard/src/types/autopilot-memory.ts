export interface AutopilotDecisionMemory {
  rules: string[];
  feedback: string[];
}

export interface AutopilotFeedbackInput {
  organizationId: string;
  id: string;
  text: string;
  sourceUrl: string | null;
  createdBy: string;
  origin?: "github" | "dashboard";
}

export interface AutopilotFeedbackUpdate {
  context: GitHubMentionContext;
  findingId: string;
  apply: (documentId: string) => Promise<void>;
}
import type { GitHubMentionContext } from "@notra/ai/types/github-mention";
