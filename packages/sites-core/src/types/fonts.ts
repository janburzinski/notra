export interface SiteFontPlan {
  /** Names the font cache directory; the same plan always gets the same key. */
  key: string;
  url: string;
  families: string[];
  /** Weight specs per family, best first. */
  candidates: (readonly [string, string[]])[];
}

export interface SiteFontEndpoints {
  /** The CSS API that plans name (`/css2`); a plan's URL and key always use Google's. */
  css: string;
  /** The only origin font files may come from. */
  files: string;
  licenses: string;
}

export interface SiteFontDownloadOptions {
  signal?: AbortSignal;
  endpoints?: SiteFontEndpoints;
}

export interface SiteFontFile {
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

/** Downloaded fonts for one plan: a stylesheet, its font files and their licenses. */
export interface SiteFontCache {
  key: string;
  files: SiteFontFile[];
}
