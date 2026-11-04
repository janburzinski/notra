export interface GoogleSearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  /** Page Google showed most for this query; absent on rows synced before pages were pulled. */
  page?: string;
  /** Google position of `page` for this query, which can differ from the query's own. */
  pagePosition?: number;
  /** Impressions of `page` for this query, a share of the query's own. */
  pageImpressions?: number;
}
