import type { SiteEntry } from "@notra/sites-compiler/types/entries";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteArea } from "@notra/sites-core/types/deployment";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type { SatoriFont } from "@notra/sites-og/types/og-images";

export interface WriteOgImagesParams {
  workDir: string;
  config: SiteConfig;
  entries: readonly SiteEntry[];
  publicFiles: readonly string[];
  includeDrafts: boolean;
  publicOrigin: string;
  /** Mounted sections, which each get a share image for their index. */
  areas: readonly SiteArea[];
}

export type OgManifest = Record<string, string>;

export interface OgImagesResult {
  manifest: OgManifest;
  diagnostics: SiteDiagnostic[];
  durationMs: number;
}

export interface OgBackgroundResult {
  dataUri?: string;
  diagnostic?: SiteDiagnostic;
}

export interface OgFontResult {
  font?: SatoriFont;
  diagnostic?: SiteDiagnostic;
}

export type FrontmatterAuthor =
  | string
  | { id?: string; name: string; title?: string; avatar?: string };
