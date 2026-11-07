import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

import type { SiteEntry } from "./entries";
import type { SiteContentLink } from "./links";

export interface SiteValidationInput {
  files: ReadonlyMap<string, string | null>;
  defaultConfig?: SiteConfig;
}

export interface SiteValidationResult {
  diagnostics: SiteDiagnostic[];
  config: SiteConfig | null;
  entries: SiteEntry[];
  /** Links and images in entries, headers, footers, slots and the snippets they import. */
  links: SiteContentLink[];
  outputs: Map<string, string>;
  ok: boolean;
}

export interface ParsedSiteConfig {
  config: SiteConfig | null;
  diagnostics: SiteDiagnostic[];
}

export interface SubstitutedSources {
  sources: Map<string, string | null>;
  diagnostics: SiteDiagnostic[];
}

export interface SubstitutedSettings {
  config: SiteConfig;
  diagnostics: SiteDiagnostic[];
}

export interface ImportCycleFrame {
  path: string;
  imports: readonly string[];
  index: number;
}

export interface IconSetting {
  name: string;
  setting: string;
}
