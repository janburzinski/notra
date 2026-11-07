import type { SiteRedirectRule } from "@notra/sites-core/types/deployment";

export interface CompiledSiteRedirect {
  /** The source split on `/`, without a trailing `/*`; `null` is a placeholder. */
  segments: readonly (string | null)[];
  prefix: boolean;
  /** Literal text, or the index of the path segment a placeholder matched. */
  destination: readonly (string | number)[];
  carriesRest: boolean;
  status: SiteRedirectRule["status"];
}

export interface RedirectPatternIssue {
  path: "source" | "destination";
  /** Errors stop the build; warnings describe text that is kept as written. */
  severity: "error" | "warning";
  message: string;
}
