import type { siteDrafts } from "@notra/db/schema";

export type SiteDraft = typeof siteDrafts.$inferSelect;

export interface SiteSourceEntry {
  path: string;
  sha: string;
  size: number;
}

export interface SiteSourceListing {
  commitSha: string;
  files: SiteSourceEntry[];
}

export interface SiteSourceFileContent {
  content: string;
  sha: string;
}

export interface RepositoryFileRef {
  path: string;
  ref: string;
}

export interface RepositoryBranchInput {
  name: string;
  sha: string;
}

export interface CreateCommitOnBranchResponse {
  createCommitOnBranch: { commit: { oid: string } };
}

export interface SaveSiteDraftInput {
  branch?: string;
  path: string;
  content: string;
  baseBlobSha: string | null;
  baseCommitSha: string | null;
  deleted?: boolean;
  userId: string;
  draftId: string | null;
  draftRevision: number | null;
  sourceContext: SiteEditorSourceContext;
}

export interface SiteEditorSourceContext {
  repositoryId: string;
  productionBranch: string;
  rootDirectory: string;
}

export interface SiteDraftMutationInput {
  branch?: string;
  path: string;
  draftId: string | null;
  draftRevision: number | null;
  sourceContext: SiteEditorSourceContext;
}

export interface PublishSiteDraftsInput {
  skipIfBusy?: boolean;
  message: string;
  branch?: string;
  userId: string;
}

export interface PublishSiteDraftsResult {
  commitSha: string;
  pullRequestUrl: string | null;
}

export interface RepositoryCommitInput {
  branch: string;
  headline: string;
  expectedHeadOid: string;
  additions: Array<{ path: string; content: string }>;
  deletions: string[];
}

export interface RepositoryPullRequestInput {
  title: string;
  head: string;
  base: string;
  body: string;
  draft?: boolean;
}
