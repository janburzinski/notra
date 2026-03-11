import type { PostSourceMetadata } from "@notra/db/schema";
import type { ToneProfile } from "@/schemas/brand";
import type { AgentDataPointSettings } from "@/types/ai/agents";
import type { GitHubSelectionFilters } from "@/types/ai/tools";

export interface ContentGenerationContext {
  organizationId: string;
  repositories: Array<{
    integrationId: string;
    owner: string;
    repo: string;
    defaultBranch: string | null;
  }>;
  tone: ToneProfile;
  promptInput: {
    sourceTargets: string;
    todayUtc: string;
    lookbackLabel: string;
    lookbackStartIso: string;
    lookbackEndIso: string;
    companyName?: string;
    companyDescription?: string;
    audience?: string;
    customInstructions?: string | null;
    language?: string;
  };
  sourceMetadata: PostSourceMetadata;
  dataPointSettings?: AgentDataPointSettings;
  selectionFilters?: GitHubSelectionFilters;
  commitWindow?: {
    since: string;
    until: string;
  };
}

export type ContentGenerationResult =
  | { status: "ok"; postId: string; title: string }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "generation_failed"; reason: string }
  | { status: "unsupported_output_type"; outputType: string };

export type ContentHandler = (
  ctx: ContentGenerationContext
) => Promise<ContentGenerationResult>;
