import type { internalSitesRequestSchema } from "@notra/schemas/api/sites";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import type { SITE_AUTHOR_PAGE_LAYOUTS } from "@notra/sites-core/constants/site-layout";
import type {
  SiteDraft,
  SitePublishedFile,
} from "@notra/sites-server/types/editor";
import type { ReactNode } from "react";
import type { z } from "zod";

import type { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import type { SITE_AUTHOR_FIELDS } from "@/constants/site-authors";
import type { SiteRawConfig } from "@/types/site-design";
import type { SiteWorkspaceValue } from "@/types/site-workspace";

type SiteAuthorLinkField = (typeof CONTENT_AUTHOR_LINK_FIELDS)[number];
type SiteAuthorField = (typeof SITE_AUTHOR_FIELDS)[number];
export type SiteAuthorPageLayout = (typeof SITE_AUTHOR_PAGE_LAYOUTS)[number];

/** An author as blog.json stores it: only `name` is required. */
export type SiteAuthor = { name: string } & Partial<
  Record<Exclude<SiteAuthorField, "name">, string>
>;

export interface SiteAuthorEntry {
  id: string;
  author: SiteAuthor;
}

/** The author form: every field as a string, empty when unset. */
export type SiteAuthorForm = { id: string } & Record<SiteAuthorField, string>;

export type SiteAuthorFormError =
  | "required"
  | "tooLong"
  | "idFormat"
  | "idTaken"
  | "avatar"
  | "https";

export type SiteAuthorFormErrors = Partial<
  Record<keyof SiteAuthorForm, SiteAuthorFormError>
>;

/** A Notra author turned into a blog.json entry, ready for review. */
export interface SiteAuthorImport {
  id: string;
  author: SiteAuthor;
  /** A dashboard-only upload that has to be copied into the site first. */
  avatarUpload: string | null;
  /** The id is already in blog.json, so importing would replace that entry. */
  exists: boolean;
}

/** What an author import needs from the site workspace to copy avatars. */
export type SiteAuthorImportWorkspace = Pick<
  SiteWorkspaceValue,
  "beginImageUpload" | "uploadImage"
>;

export interface SiteAuthorImportResult {
  entries: SiteAuthorEntry[];
  /** Names of authors whose avatar couldn't be copied. */
  failedAvatars: string[];
}

/** The Sites site whose blog.json authors a post's author picker offers. */
export interface PostAuthorSite {
  id: string;
  name: string;
  /** Where the site serves its blog, used to show blog.json avatar paths. */
  liveUrl: string;
}

export interface SiteAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The author being edited, or null for a new one. */
  entry: SiteAuthorEntry | null;
  /** Ids other authors already use. */
  takenIds: ReadonlySet<string>;
  /** Notra posts that name this author; null while unknown. */
  usage: number | null;
  /** The id is in the published blog.json, so changing it affects posts. */
  published: boolean;
  onSave: (previousId: string | null, entry: SiteAuthorEntry) => void;
}

export interface SiteAuthorFieldProps {
  id: string;
  label: string;
  error: string | undefined;
  hint?: ReactNode;
  children: (aria: SiteAuthorFieldAria) => ReactNode;
}

export interface SiteAuthorLinkIconProps {
  field: SiteAuthorLinkField;
}

interface SiteAuthorFieldAria {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export interface SiteAuthorIdFieldProps {
  id: string;
  value: string;
  error: string | undefined;
  /** The author's current id while posts may use it, else null. */
  lockedId: string | null;
  usage: number | null;
  onChange: (id: string) => void;
}

export interface SiteAuthorLinkFieldsProps {
  idPrefix: string;
  form: SiteAuthorForm;
  errors: SiteAuthorFormErrors;
  onChange: (field: SiteAuthorLinkField, value: string) => void;
}

export interface SiteAuthorRowProps {
  entry: SiteAuthorEntry;
  pageUrl: string | null;
  usage: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

export interface SiteAuthorsEmptyProps {
  onAdd: () => void;
}

export interface SiteAuthorImportRowProps {
  count: number;
  onOpen: () => void;
}

export interface SiteAuthorPagesProps {
  blogMount: string;
  onChange: (config: SiteRawConfig) => void;
}

export interface SiteAuthorDeleteDialogProps {
  entry: SiteAuthorEntry | null;
  /** Notra posts that name the author; null while unknown. */
  usage: number | null;
  onConfirm: () => void;
  onClose: () => void;
}

export interface SiteAuthorImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authors: ContentAuthor[];
  siteIds: ReadonlySet<string>;
  onImport: (imports: SiteAuthorImport[]) => Promise<void>;
}

export interface SiteAuthorPageLayoutProps {
  value: SiteAuthorPageLayout;
  onChange: (value: SiteAuthorPageLayout) => void;
}

export interface SiteAuthorLayoutSketchProps {
  layout: SiteAuthorPageLayout;
}

export interface SiteAuthorSketchLineProps {
  className: string;
}

export interface SiteAuthorAvatarProps {
  name: string;
  avatar: string | undefined;
  className?: string;
}

export interface OverviewSiteAuthorSelectProps {
  organizationId: string;
  site: PostAuthorSite;
  authors: SiteAuthorEntry[];
  authorIds: string[];
  addHref: string;
  onChange: (authorIds: string[]) => void;
}

export interface OverviewAuthorsFieldProps {
  organizationId: string;
  organizationSlug: string;
  contentId: string;
  authorIds: string[];
  onChange: (authorIds: string[]) => void;
}

export interface OverviewSiteAuthorsFieldProps extends Omit<
  OverviewAuthorsFieldProps,
  "contentId"
> {
  site: PostAuthorSite;
  authors: SiteAuthorEntry[];
}

export interface OverviewNotraAuthorsFieldProps extends Omit<
  OverviewAuthorsFieldProps,
  "contentId" | "organizationSlug"
> {
  loading: boolean;
}

export interface SiteAuthorAvatarFieldProps {
  id: string;
  /** For the initials shown until an image is set. */
  name: string;
  value: string;
  onChange: (avatar: string) => void;
  aria: SiteAuthorFieldAria;
}

/** blog.json as the Design tab edits it, read on the server. */
export interface SiteAuthorsDocument {
  file: SitePublishedFile | null;
  draft: SiteDraft | null;
  /** The draft when there is one, else the published file or the default config. */
  content: string;
  config: SiteRawConfig;
  /** The committed blog.json, empty when the repository has none: what decides which authors are live. */
  published: SiteRawConfig;
}

/** A Sites authors request the public API forwards to the dashboard. */
export type SiteAuthorApiRequest = z.infer<typeof internalSitesRequestSchema>;

export interface SiteDesignAuthorsBodyProps {
  state: SiteWorkspaceValue;
}
