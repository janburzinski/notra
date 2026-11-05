import type { SiteDiagnostic } from "@notra/sites-core/types/build";

import type { FontFallback } from "../../src/types/theme";

export interface SiteFontsResult {
  stylesheet?: string;
  publicFiles: string[];
  diagnostics: SiteDiagnostic[];
}

export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
  unitsPerEm: number;
  xWidthAvg: number;
}

export interface SiteFontFallbacksParams {
  siteRoot: string;
  workDir: string;
  /** Files in the site's public/ directory, as /paths. */
  publicFiles: ReadonlySet<string>;
  /** The downloaded Google Fonts stylesheet, as a /path in the built site. */
  stylesheet?: string;
}

export interface SiteFontFallbacksResult {
  fallbacks: FontFallback[];
  diagnostics: SiteDiagnostic[];
}
