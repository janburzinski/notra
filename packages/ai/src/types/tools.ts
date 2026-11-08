import type {
  AgentDataPointSettings,
  ResolveLinearIntegrationContext,
} from "@notra/ai/types/agents";

export interface CommitWindow {
  since: string;
  until: string;
}

export interface EditMarkdownContext {
  currentMarkdown: string;
  onUpdate: (markdown: string) => void;
  filename?: string;
}

export interface GitHubToolRepositoryContext {
  integrationId: string;
  organizationId: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  token: string | undefined;
}

export interface GitHubToolsAccessConfig {
  organizationId?: string;
  allowedIntegrationIds?: string[];
  allowedPullRequestNumbersByIntegrationId?: Record<string, number[]>;
  allowedReleaseTagsByIntegrationId?: Record<string, string[]>;
  allowedReleaseTagsGlobal?: string[];
  allowedCommitShas?: string[];
  enforcedCommitWindow?: CommitWindow;
}

export interface GitHubSelectionFilters {
  allowedPullRequestNumbersByIntegrationId?: Record<string, number[]>;
  allowedReleaseTagsByIntegrationId?: Record<string, string[]>;
  allowedReleaseTagsGlobal?: string[];
  allowedCommitShas?: string[];
}

export interface LinearToolContext {
  integrationId: string;
  organizationId: string;
  accessToken: string;
  linearTeamId?: string | null;
}

export interface LinearToolsAccessConfig {
  organizationId?: string;
  allowedIntegrationIds?: string[];
}

export interface GranolaToolContext {
  integrationId: string;
  organizationId: string;
  apiKey: string;
  workspaceName?: string | null;
}

export interface GranolaToolsAccessConfig {
  organizationId?: string;
  allowedIntegrationIds?: string[];
}

export interface ErrorWithStatus {
  status?: number;
  message?: string;
  response?: {
    headers?: Record<string, string | number | undefined>;
    data?: unknown;
  };
}

export interface SkillMetadata {
  name: string;
  version?: string;
  description?: string;
  "allowed-tools"?: string[];
  folder: string;
  filename: string;
}

export interface Skill extends SkillMetadata {
  content: string;
}

export interface ToolDescription {
  intro: string;
  toolName: string;
  whenToUse?: string;
  whenNotToUse?: string;
  usageNotes?: string;
}

export type CachedWrapper = <TTool extends object>(
  tool: TTool,
  options?: {
    ttl?: number;
    keyGenerator?: (params: unknown, context?: unknown) => string;
    shouldCache?: (params: unknown, result: unknown) => boolean;
    debug?: boolean;
  }
) => TTool;

export interface BuildLinearDataToolsOptions {
  organizationId: string;
  allowedIntegrationIds: string[];
  dataPointSettings?: AgentDataPointSettings;
  resolveContext?: ResolveLinearIntegrationContext;
}

/**
 * Authors of the Notra site a post publishes to. A post on a site credits
 * these instead of the organization's Notra authors.
 */
export interface PostSiteAuthors {
  /** The site's authors, by the id posts name them with. */
  authors: { slug: string; name: string; title: string | null }[];
  /** The value stored in the post's author ids for a site author. */
  ref: (slug: string) => string;
  /** The site author a stored author id names, or null for a Notra author. */
  slugOf: (value: string) => string | null;
}

export type ResolvePostSiteAuthors = (target: {
  organizationId: string;
  postId: string;
}) => Promise<PostSiteAuthors | null>;

export interface PostDetailsToolsContext {
  organizationId: string;
  postId: string;
  resolveSiteAuthors?: ResolvePostSiteAuthors;
}
