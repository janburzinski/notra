import type {
  AutopilotCitationDrop,
  AutopilotComparisonTarget,
  AutopilotCopyChange,
  AutopilotInternalLink,
  AutopilotPageAudit,
  AutopilotRenderingIssue,
} from "@notra/db/types/autopilot";

/** One stored AI answer, as the refresh and comparison checks read it. */
export interface AutopilotAnswerCheck {
  promptId: string;
  prompt: string;
  engine: string;
  capturedAt: Date;
  mentioned: boolean;
  competitors: string[];
  excerpt: string;
  queries: string[];
  /** Every URL the answer cited or searched, inline and in the source panel. */
  sourceUrls: string[];
}

/** An owned page whose citations dropped between two equal windows. */
export interface AutopilotCitationCandidate {
  /** The URL as the engines cited it, for fetching and linking. */
  url: string;
  /** host/path without www, query, hash or trailing slash. */
  key: string;
  promptIds: string[];
  drop: AutopilotCitationDrop;
  /** Citations lost, weighted by how many prompts the page served. */
  score: number;
  /** The file behind the page when Autopilot wrote it, so no lookup by URL. */
  path?: string;
  /** Set when this is an Autopilot post whose numbers did not move. */
  underperforming?: {
    findingId: string;
    mergedDaysAgo: number;
    promptId: string;
  };
}

/** A competitor that wins comparison questions the brand loses. */
export interface AutopilotComparisonCandidate extends AutopilotComparisonTarget {
  /** Distinct comparison prompts whose answers name the competitor and not the brand. */
  losses: number;
  /** The leading prompt, measured after the merge, and the share of its answers naming the brand now. */
  promptId: string;
  mentionRate: number;
  excerpts: string[];
  searches: string[];
  citedUrls: string[];
}

export interface AutopilotPageEdit {
  action: "update" | "add" | "cut";
  section: string;
  find: string;
  replace: string;
}

export interface AutopilotAppliedEdits {
  content: string;
  applied: AutopilotPageEdit[];
  rejected: { edit: AutopilotPageEdit; reason: string }[];
}

/** Why a refreshed page may not be committed; null when it may. */
export type AutopilotRefreshProblem = string | null;

export interface AutopilotRefreshCheck {
  candidate: AutopilotCitationCandidate;
  /** Repository file that renders the page. */
  path: string;
  original: string;
  baseSha: string;
}

export interface AutopilotRefreshFix {
  audit: AutopilotPageAudit;
  title: string;
  summary: string;
  content: string;
  applied: AutopilotPageEdit[];
  checks: string[];
}

/** One page as an AI crawler and a browser got it. */
export interface AutopilotPageFetch {
  url: string;
  status: number | null;
  rawText: string;
  renderedText: string;
  /** Where the browser ended up; another page means a JavaScript redirect. */
  renderedUrl?: string | null;
}

/** Text a writer worked from: a page it read, the AI answers, the brand. */
export interface AutopilotFactSource {
  label: string;
  text: string;
}

export interface AutopilotFactClaim {
  claim: string;
  about: "competitor" | "brand" | "other";
  supported: boolean;
  source: string;
  quote: string;
  fix: { find: string; replace: string } | null;
}

/** What the fact check did to a page, for the pull request. */
export interface AutopilotFactReport {
  checked: number;
  supported: number;
  removed: string[];
  /** Brand claims no source states; kept for a person to confirm. */
  unconfirmed: string[];
  /** Prices and figures no source contains. */
  figures: string[];
  /** Unsourced claims no edit could take out; kept for a person to fix. */
  uncut: string[];
}

export interface AutopilotRenderingProblem extends AutopilotRenderingIssue {
  /** Sentences people see that the crawler does not, a few for the agent. */
  missing: string[];
}

/** A page ranking on page one or two that links from other posts could lift. */
export interface AutopilotLinkTarget {
  url: string;
  /** host/path without www, query, hash or trailing slash. */
  key: string;
  /** Impression-weighted position over its anchors. */
  position: number;
  impressions: number;
  /** Search Console queries the page ranks for, as anchors for links to it. */
  anchors: { query: string; position: number; impressions: number }[];
}

/** One place in a post where an anchor could become a link. */
export interface AutopilotLinkSpot {
  id: string;
  sourceUrl: string;
  sourcePath: string;
  /** Zero-based line in the file, and the phrase's offsets in that line. */
  line: number;
  start: number;
  end: number;
  /** The phrase exactly as the post writes it. */
  text: string;
  href: string;
  targetUrl: string;
  targetKey: string;
  query: string;
  position: number;
  impressions: number;
  /** The paragraph around the phrase, for the review. */
  context: string;
}

export interface AutopilotLinksCheck {
  baseSha: string;
  spots: AutopilotLinkSpot[];
}

export interface AutopilotLinksFix {
  title: string;
  summary: string;
  files: { path: string; contents: string }[];
  links: AutopilotInternalLink[];
  checks: string[];
}

/** The text a file's new version changes, or why it changes more than text. */
export type AutopilotCopyCheck =
  | { ok: true; changes: AutopilotPageCopyChange[] }
  | { ok: false; reason: string };

/** A copy change and whether it is the page's title or description rather than text on it. */
export interface AutopilotPageCopyChange extends AutopilotCopyChange {
  metadata: boolean;
}

/** A page rendered from code that lost AI citations or ranks 4 to 20 in Google. */
export interface AutopilotLandingCandidate {
  url: string;
  /** host/path without www, query, hash or trailing slash. */
  key: string;
  signal: "citations" | "search";
  /** Citations before and now; null for a search candidate. */
  drop: AutopilotCitationDrop | null;
  promptIds: string[];
  queries: { query: string; position: number; impressions: number }[];
}

export interface AutopilotLandingCheck {
  candidate: AutopilotLandingCandidate;
  /** What the live page says now, so a change can be traced to the page. */
  pageText: string;
  /** What the homepage says, for any other page: text it shares is a shared component's. */
  homeText: string | null;
}
