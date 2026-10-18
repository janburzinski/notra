import type { SiteEntry } from "@notra/sites-compiler/types/entries";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type satori from "satori";

export interface WriteOgImagesParams {
  workDir: string;
  config: SiteConfig;
  entries: readonly SiteEntry[];
  publicFiles: readonly string[];
  includeDrafts: boolean;
  publicOrigin: string;
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

export interface OgCardContent {
  eyebrow: string;
  title: string;
  footer: string;
  appearance: "light" | "dark";
  accent: string;
  background?: string;
}

export interface OgAuthor {
  name: string;
  title?: string;
  avatar?: string;
}

export interface OgAuthorCardContent {
  label: string;
  title: string;
  domain: string;
  appearance: "light" | "dark";
  logo?: string;
  author?: OgAuthor;
  background?: string;
}

export interface OgArticleCardContent {
  date: string;
  category: string;
  title: string;
  description?: string;
  domain: string;
  appearance: "light" | "dark";
  accent: string;
  logo?: string;
  authors: OgAuthor[];
  background?: string;
}

export type SatoriFont = Parameters<typeof satori>[1]["fonts"][number];
