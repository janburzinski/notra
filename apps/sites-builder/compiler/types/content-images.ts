import type { SiteDiagnostic } from "@notra/sites-core/types/build";

/** An <img> inside post content that may get a srcset. */
export interface ContentImageTag {
  /** The src attribute as written in the page, e.g. `/blog/images/a.png`. */
  src: string;
  /** Offset where new attributes are inserted, just before `>` or `/>`. */
  insertAt: number;
  loading: string | undefined;
  hasSizes: boolean;
  /** Both width and height attributes are set, so the layout doesn't depend on the file. */
  hasDimensions: boolean;
}

export interface ContentImageCandidate {
  url: string;
  width: number;
}

/** The srcset for one source image, or null when it is left as it is. */
export type ContentImageVariants = readonly ContentImageCandidate[] | null;

export interface OptimizeContentImagesParams {
  outDir: string;
  /** Built pages by URL path; only pages whose images change are returned. */
  pageHtml: ReadonlyMap<string, string>;
  /** Mount paths of the built sections, e.g. `/blog`. */
  mounts: readonly string[];
  /** Overrides the clock, for tests. */
  now?: () => number;
  /** Overrides the image limits, for tests. */
  budget?: ContentImageBudget;
  /** Overrides the sharp import, for tests. */
  loadSharp?: () => Promise<SharpFactory>;
}

export interface OptimizeContentImagesResult {
  pages: Map<string, string>;
  diagnostics: SiteDiagnostic[];
  images: number;
  variants: number;
  durationMs: number;
}

export type SharpFactory = (typeof import("sharp"))["default"];

export interface ContentImageBudget {
  maxImages: number;
  maxDurationMs: number;
  concurrency: number;
}
