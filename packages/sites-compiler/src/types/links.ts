import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

import type { SiteEntry } from "./entries";

export type ContentLinkKind = "link" | "image";

export interface ContentLink {
  url: string;
  kind: ContentLinkKind;
  offset: number;
}

/** An entry's page, or with no slug, the area's index, which every mounted area has. */
export interface LinkPage {
  area: SiteArea;
  slug?: string;
  draft?: boolean;
  /** Instead: any page under this path, like the author pages, which only a build can tell exist. */
  under?: string;
}

export interface SiteContentLink {
  file: string;
  /** The pages the link is shown on; it's only checked when one of them is published. */
  pages: LinkPage[];
  /** In a header, footer, slot or snippet, where relative URLs and same-page fragments depend on the page. */
  shared: boolean;
  url: string;
  kind: ContentLinkKind;
  line: number;
  column?: number;
}

interface LinkCheckSite {
  mounts: SiteMounts;
  publicOrigin: string;
  /** Files in public/ by the path they're referenced with, such as /images/a.png. */
  publicFiles: ReadonlySet<string>;
  redirects: SiteConfig["redirects"];
}

export interface LinkCheckContext extends LinkCheckSite {
  /** URL path of every built file, such as /blog/launch/index.html. */
  files: ReadonlySet<string>;
  /** The element IDs on a built HTML page in `files`, or null when they can't be known. */
  ids?: (file: string) => ReadonlySet<string> | null;
}

export interface SourceLinkCheckContext extends LinkCheckSite {
  entries: readonly SiteEntry[];
}

/** What the check knows about the site: a full build knows every file, the source alone only some. */
export interface LinkResolver {
  isPublished: (page: LinkPage) => boolean;
  /** Whether a normalized path under a mount is served, or null when only a build can tell. */
  serves: (path: string) => boolean | null;
  /** The element IDs on the page served at a path, or null when they aren't known. */
  ids: (path: string) => ReadonlySet<string> | null;
  /** Page paths to suggest for a broken link. */
  pages: readonly string[];
}

export interface LinkTarget {
  /** The path the Sites worker serves, or null when it answers 400 because it can't read it. */
  path: string | null;
  /** The URL's path as written, still encoded. */
  pathname: string;
  /** Written as a root path, which the build points at public/ when the file is there. */
  rootPath: boolean;
  /** The decoded #fragment, or null without one. */
  fragment: string | null;
  /** The fragment as written in the URL, before decoding. */
  rawFragment: string | null;
}
