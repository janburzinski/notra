export interface SiteFontPlan {
  /** Names the font cache directory; the same plan always gets the same key. */
  key: string;
  url: string;
  families: string[];
  /** Weight specs per family, best first. */
  candidates: (readonly [string, string[]])[];
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
