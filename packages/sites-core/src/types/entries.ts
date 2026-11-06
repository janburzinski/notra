import type { SiteArea, SiteMounts } from "./deployment";

export interface SiteEntryFile {
  area: SiteArea;
  slug: string;
  format: "md" | "mdx";
}

export interface SiteEntryPagePathInput {
  /** Repository path of the entry file, e.g. `docs/blog/launch.mdx`. */
  filePath: string;
  rootDirectory: string;
  mounts: SiteMounts;
}
