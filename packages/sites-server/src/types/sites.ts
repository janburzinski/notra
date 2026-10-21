import type { sites } from "@notra/db/schema";
import type { POST_PREVIEW_LIFETIMES } from "@notra/sites-core/constants/sites";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import type { z } from "zod";

import type { postPreviewSourceSchema } from "../schemas/post-preview";

export type Site = typeof sites.$inferSelect;

export type SiteInputField =
  | "repository"
  | "name"
  | "slug"
  | "rootDirectory"
  | "sections";

export interface SiteNameRejection {
  message: string;
  field: "name" | "slug";
}

export interface SiteNameRejectionParams {
  organizationId: string;
  userId: string;
  name: string;
  address: string;
  slug?: string;
}

export type SiteUpdateValues = Partial<typeof sites.$inferInsert>;

export interface CreateSiteInput {
  organizationId: string;
  userId: string;
  projectId: string;
  name: string;
  slug?: string;
  repositoryId: string;
  productionBranch?: string;
  rootDirectory?: string;
  mounts?: SiteMounts;
  previewVisibility?: Site["previewVisibility"];
  publishMode?: Site["publishMode"];
  previewsEnabled?: boolean;
}

export interface RepositorySuggestionsParams {
  organizationId: string;
  repositoryId: string;
  ref: string | null;
}

export interface DeployBranchHeadOptions {
  trigger: "manual" | "config" | "redeploy";
  userId?: string | null;
  branch?: string;
  previewKey?: string | null;
  /** Shown instead of the head commit's message. */
  commitMessage?: string;
}

export interface SiteSettingsPatch {
  name?: string;
  repositoryId?: string;
  productionBranch?: string;
  rootDirectory?: string;
  mounts?: SiteMounts;
  previewsEnabled?: boolean;
  smartDeployments?: boolean;
  previewCommentsEnabled?: boolean;
  previewVisibility?: Site["previewVisibility"];
  publishMode?: Site["publishMode"];
  showBranding?: boolean;
  analyticsEnabled?: boolean;
  previewPassword?: string | null;
  publicOrigin?: string;
}

export interface CreateSiteResult {
  site: Site;
  jobId: string | null;
}

export interface BranchPreviewResult {
  jobId: string;
  previewKey: string;
}

export interface UpdateSiteSettingsResult {
  site: Site;
  syncJobId: string;
  rebuilding: boolean;
}

export interface SiteCleanupResult {
  deleted: string[];
}

export interface PostPreviewFile {
  /** Path inside the site's root directory. */
  path: string;
  contents: Uint8Array;
}

export type PostPreviewSource = z.infer<typeof postPreviewSourceSchema>;
export type PostPreviewLifetime = keyof typeof POST_PREVIEW_LIFETIMES;

export interface PostPreviewAccessInput {
  lifetime: PostPreviewLifetime;
  /** Null opens the preview to anyone with the link; undefined keeps the current one. */
  password?: string | null;
}

export interface CreatePostPreviewInput extends PostPreviewAccessInput {
  postId: string;
  title: string;
  pagePath: string;
  files: PostPreviewFile[];
  userId?: string;
}

export interface UpdatePostPreviewAccessInput {
  lifetime?: PostPreviewLifetime;
  /** Undefined keeps the current password. */
  password?: string | null;
}
