import { sourceLinkDiagnostics } from "@notra/sites-compiler/links";
import type { SiteValidationResult } from "@notra/sites-compiler/types/validate";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteMounts } from "@notra/sites-core/types/deployment";

/** The link and image warnings validate and the dev server give without building the pages. */
export function sourceLinkWarnings(
  validation: SiteValidationResult,
  mounts: SiteMounts,
  publicOrigin: string,
  publicFiles: Iterable<string>
): SiteDiagnostic[] {
  if (!validation.config) {
    return [];
  }
  return sourceLinkDiagnostics(validation.links, {
    mounts,
    publicOrigin,
    publicFiles: new Set(publicFiles),
    redirects: validation.config.redirects,
    entries: validation.entries,
  });
}
