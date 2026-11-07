export type DataTrafficKind = "crawlers" | "referrals";

/** A change ready to render; `value` is the rounded figure, null when new. */
export interface DataTrendValue {
  value: number | null;
  /** Signed, e.g. "+12%". */
  signed: string;
}

/** One chart row: the day, its total visits per site, and one key per bot or assistant. */
export type DataTrafficRow = Record<string, string | number | null> & {
  day: string;
  rawDay: string;
  total: number | null;
};

/** One traffic chart: its rows, the series its tooltip lists, and the headline figure. */
export interface DataTraffic {
  rows: DataTrafficRow[];
  /** Domain is the company's, for the tooltip logo; null for "Other". */
  series: { key: string; label: string; domain: string | null }[];
  /** Sites a chart day needs; below it the day sits on the zero line. */
  minSites: number;
  /** Average daily visits per site over the last 7 days. */
  recent: number | null;
  /** Change of that average against the 7 days before. */
  change: number | null;
}

interface DataCrawlerRow {
  id: string;
  label: string;
  vendor: string | null;
  purpose: string;
  share: number;
  dailyPerSite: number;
  reach: number;
  change: number | null;
  markdownShare: number | null;
  llmsTxtReach: number | null;
}

interface DataAssistantRow {
  id: string;
  label: string;
  vendor: string | null;
  share: number;
  change: number | null;
  pagesPerVisit: number | null;
  multiPageShare: number | null;
}

interface DataCompanyRow {
  vendor: string;
  domain: string | null;
  crawlShare: number;
  referralShare: number;
  crawlsPerReferral: number;
}

interface DataPurposeRow {
  purpose: string;
  share: number;
  change: number | null;
}

interface DataCountryRow {
  country: string;
  name: string;
  share: number;
  change: number | null;
}

interface DataAgentFileRow {
  id: string;
  label: string;
  vendor: string | null;
  llmsTxtReach: number;
  markdownShare: number | null;
}

/** One slice of a market share bar. */
export interface DataShareSegment {
  key: string;
  label: string;
  /** Company site for the logo; null for purposes and "Other". */
  domain: string | null;
  share: number;
}

/** Share of the week's visits per weekday (Mon first) and UTC hour. */
export type DataHourGrid = number[][];

/**
 * What the /data page renders, built on the server from the daily snapshot so
 * the browser only receives the figures it shows.
 */
export interface DataPageModel {
  day: string;
  generatedAt: string;
  windowFrom: string;
  /** Days each chart point averages, ending on its day. */
  averageDays: number;
  minSites: number;
  /** Headline figures: crawls per referral (28 days), training and Markdown shares (7 days). */
  summary: {
    crawlsPerReferral: number | null;
    trainingShare: number | null;
    markdownShare: number | null;
  };
  traffic: Record<DataTrafficKind, DataTraffic>;
  crawlers: DataCrawlerRow[];
  assistants: DataAssistantRow[];
  companies: DataCompanyRow[];
  shares: {
    crawls: DataShareSegment[];
    referrals: DataShareSegment[];
    purposes: DataShareSegment[];
  };
  purposes: DataPurposeRow[];
  countries: DataCountryRow[];
  agentFiles: DataAgentFileRow[];
  /** A kind's grid is null when too few sites had that traffic. */
  hours: Record<DataTrafficKind, DataHourGrid | null> | null;
}

/** What a side drawer shows: one bot, one assistant or one company. */
export type DataSelection =
  | { kind: "crawler"; id: string }
  | { kind: "assistant"; id: string }
  | { kind: "company"; id: string };
