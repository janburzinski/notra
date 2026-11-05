import type { SiteBuildRequest } from "@notra/sites-core/types/build";

export interface BuildSiteOptions {
  toolchainRoot: string;
  siteRoot: string;
  target: SiteBuildRequest;
  outDir: string;
  workDir?: string;
  /** No Notra worker will serve this output, so it writes the footer favicon itself. */
  localFavicons?: boolean;
}

export interface WriteLocalFaviconsParams {
  outDir: string;
  mounts: readonly string[];
  host: string;
  /** Overrides fetch, for tests. */
  fetch?: FaviconFetch;
}

export interface AstroPackageJson {
  bin: string | Record<string, string>;
}

export type FaviconFetch = (
  url: string,
  init: RequestInit
) => Promise<Response>;
