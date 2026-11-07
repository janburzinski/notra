import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

export type ContentLinkKind = "link" | "image";

export interface ContentLink {
  url: string;
  kind: ContentLinkKind;
  offset: number;
}

export interface SiteContentLink {
  file: string;
  area: SiteArea;
  slug: string;
  url: string;
  kind: ContentLinkKind;
  line: number;
  column?: number;
}

export interface LinkCheckContext {
  mounts: SiteMounts;
  publicOrigin: string;
  /** URL path of every built file, such as /blog/launch/index.html. */
  files: ReadonlySet<string>;
  /** Files in public/ by the path they're referenced with, such as /images/a.png. */
  publicFiles: ReadonlySet<string>;
  redirects: SiteConfig["redirects"];
}

export interface LinkTarget {
  path: string;
  /** Written as a root path, which the build points at public/ when the file is there. */
  rootPath: boolean;
}
