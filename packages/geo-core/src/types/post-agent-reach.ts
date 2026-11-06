import type { GeoTrafficPoint, GeoTrafficSource } from "./geo";

/** Where a published post is live: its Site and the path the page is served at. */
export interface PostAgentReachTarget {
  postId: string;
  siteId: string;
  /** The page path, e.g. `/blog/launch`. */
  path: string;
  /** The page and its agent-facing copies (`.md` twin, index files). */
  trafficPaths: string[];
  url: string;
}

export interface PostAgentReachTotals {
  /** Training and search-index crawls, excluding citations. */
  crawled: number;
  /** An assistant read the page while answering someone. */
  cited: number;
  /** People who clicked through from an AI answer. */
  referred: number;
  total: number;
}

export interface PostAgentReach {
  postId: string;
  siteId: string;
  path: string;
  url: string;
  configured: boolean;
  totals: PostAgentReachTotals;
  sources: GeoTrafficSource[];
  points: GeoTrafficPoint[];
}

/** List view: totals only, so citations count as crawler visits here. */
export interface PostAgentReachSummary {
  postId: string;
  /** False when the analytics query failed, so the totals are unknown. */
  available: boolean;
  crawler: number;
  aiReferral: number;
  total: number;
}

export type PostAgentReachToolResult =
  | { live: false; message: string }
  | {
      live: true;
      url: string;
      path: string;
      configured: boolean;
      totals: PostAgentReachTotals;
      sources: {
        engine: string;
        agent: string | null;
        kind: "crawled" | "cited" | "referred";
        visits: number;
        lastSeenAt: string;
      }[];
    };

export interface PostAgentReachSummaryInput {
  organizationId: string;
  postId: string;
  days?: number;
  from?: string;
  to?: string;
}
