import type { SiteValidationResult } from "@notra/sites-compiler/types/validate";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

import type { FontFallback } from "../../src/types/theme";

export interface SiteSourceFile {
  path: string;
  size: number;
}

export interface CollectedSource {
  ignoreContent: string | null;
  files: SiteSourceFile[];
  totalBytes: number;
  diagnostics: SiteDiagnostic[];
}

export interface SiteFiles {
  collected: CollectedSource;
  files: Map<string, string | null>;
}

export interface PrepareSiteParams {
  siteRoot: string;
  workDir: string;
  defaultConfig?: SiteConfig;
  incremental?: boolean;
}

export interface PreparedCustomScript {
  path: string;
  fileName: string;
}

export interface PreparedSite {
  validation: SiteValidationResult;
  collectDiagnostics: SiteDiagnostic[];
  publicFiles: string[];
  customScripts: PreparedCustomScript[];
  fontStylesheet?: string;
  fontFallbacks?: FontFallback[];
}

export type Inspected =
  | { kind: "skip" }
  | { kind: "diagnostic"; diagnostic: SiteDiagnostic }
  | { kind: "directory"; path: string }
  | { kind: "file"; file: SiteSourceFile };
