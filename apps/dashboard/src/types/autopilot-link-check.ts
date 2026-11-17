/** A link found while reading the site, with the pages (paths) that carry it. */
interface AutopilotLinkCheckLink {
  url: string;
  foundOn: string[];
}

export interface AutopilotBrokenLink extends AutopilotLinkCheckLink {
  status: number;
  /** On the checked site itself rather than another one. */
  internal: boolean;
}

export interface AutopilotUnreachableLink extends AutopilotLinkCheckLink {
  internal: boolean;
}

/** A path real visitors opened that answered 404. */
export interface AutopilotMissingPage {
  path: string;
  views: number;
}

/** What the first step hands the second: the site's links, not yet checked. */
export interface AutopilotLinkCheckState extends Record<string, unknown> {
  site: string;
  pagesChecked: number;
  /** Pages that didn't load, so their links weren't read. */
  pagesFailed: number;
  links: AutopilotLinkCheckLink[];
  /** Links found past the check limit. */
  skipped: number;
  days: number;
  missingPages: AutopilotMissingPage[];
}

export type AutopilotLinkStatus =
  | { kind: "ok" }
  | { kind: "gone"; status: number }
  | { kind: "unreachable" };
