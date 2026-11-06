export type PublicAiTrafficKind = "crawler" | "ai_referral";

/** `geo_traffic_trends_daily` row; an empty `visitor_type` is the day's total. */
export interface PublicAiTrafficDailyRow {
  day: string;
  visitor_type: string;
  source: string;
  category: string;
  visits: number;
  markdown_visits: number;
  projects: number;
}

/** `geo_traffic_trends_projects` row; `weeks_ago` 0 is the last 7 full days. */
export interface PublicAiTrafficProjectRow {
  project_id: string;
  visitor_type: string;
  source: string;
  weeks_ago: number;
  visits: number;
  /** Visits that asked for Markdown; counts the sites behind Markdown shares. */
  markdown_visits: number;
}

/**
 * `geo_traffic_trends_detail` row. `hours`: `key` is "weekday:hour" (Mon = 1,
 * UTC) and `sites` the kind's sites. `countries`: `key` is the ISO country,
 * with recent and previous shares and sites. `llms_txt`: `key` is the crawler,
 * `sites` the sites it visited and `subset_sites` those where it fetched
 * /llms.txt.
 */
export interface PublicAiTrafficDetailRow {
  section: string;
  visitor_type: string;
  key: string;
  share: number;
  previous_share: number;
  sites: number;
  previous_sites: number;
  subset_sites: number;
}

export interface PublicAiTrafficInput {
  /** UTC day the snapshot is published on; it covers the days before. */
  today: string;
  generatedAt: string;
  daily: PublicAiTrafficDailyRow[];
  projects: PublicAiTrafficProjectRow[];
  /** Hours, countries and llms.txt; empty leaves those sections out. */
  detail?: PublicAiTrafficDetailRow[];
}

export interface PublicAiTrafficWindow {
  from: string;
  /** Last full day, inclusive. */
  to: string;
  toExclusive: string;
  recentFrom: string;
}

export interface PublicAiTrafficSourceTotals {
  id: string;
  kind: PublicAiTrafficKind;
  source: string;
  recent: number;
  previous: number;
  matchedRecent: number;
  matchedPrevious: number;
  ratioVisits: number;
  /** Visits per site in the recent week. */
  recentSites: Map<string, number>;
  /** Sites it visited in the week before, for the previous-share floor. */
  previousSites: Set<string>;
  /** Sites measured in both weeks that it visited, per week: the change floor. */
  matchedRecentSites: Set<string>;
  matchedPreviousSites: Set<string>;
  ratioSites: Set<string>;
}
