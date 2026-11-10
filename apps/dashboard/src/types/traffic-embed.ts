import type {
  AiTrafficResponse,
  GeoLanguageSharePoint,
  GeoOverviewEngine,
  GeoSparklinePoint,
  GeoTimeseriesPoint,
  ShareOfVoiceRow,
  WebAnalyticsBreakdown,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";
import type { TRAFFIC_EMBED_CHARTS } from "@notra/schemas/constants/dashboard/traffic-embed";
import type { ChartColorPair } from "@notra/ui/types/charts";

export type TrafficEmbedRange = "7d" | "14d" | "30d" | "90d";

export type TrafficEmbedTheme = "light" | "dark" | "auto";

export type TrafficEmbedPart = "metrics" | "chart";

export type TrafficEmbedChart = (typeof TRAFFIC_EMBED_CHARTS)[number];

/** AI agent traffic or web visitors, matching the Analytics source tabs. */
export type TrafficEmbedSource = "agents" | "web";

export interface TrafficEmbedSummary {
  id: string;
  name: string;
  projectId: string | null;
  host: string | null;
  source: TrafficEmbedSource;
  allowedOrigins: string[];
  charts: TrafficEmbedChart[];
  createdAt: string;
}

/** What the public page needs to decide who may frame it and what to load. */
export interface TrafficEmbedConfig {
  id: string;
  organizationId: string;
  projectId: string | null;
  host: string | null;
  source: TrafficEmbedSource;
  allowedOrigins: string[];
  charts: TrafficEmbedChart[];
}

/**
 * A share-of-voice row ready to draw. The server folds names, picks the top
 * brands and colors them, so the page never receives the competitor list or
 * brand settings.
 */
export interface TrafficEmbedShareOfVoiceRow extends ShareOfVoiceRow {
  own: boolean;
  color: ChartColorPair;
  mentionTrend: GeoSparklinePoint[];
}

/** The web summary an embed shows; no pages, sources or hosts leave Notra. */
type PublicWebTraffic = Pick<
  WebAnalyticsResponse,
  "totals" | "points" | "imported"
>;

/** The traffic chart's numbers: AI agents or web visitors, as the embed was made. */
type TrafficEmbedTraffic =
  | { source: "agents"; traffic: AiTrafficResponse }
  | { source: "web"; web: PublicWebTraffic };

/**
 * Each query an embed can run. Charts that need the same numbers share one
 * load and one cache entry.
 */
export interface TrafficEmbedSourceData {
  traffic: TrafficEmbedTraffic;
  timeseries: GeoTimeseriesPoint[];
  overview: GeoOverviewEngine[];
  shareOfVoice: TrafficEmbedShareOfVoiceRow[];
  languages: GeoLanguageSharePoint[];
  countries: WebAnalyticsBreakdown[];
}

export type TrafficEmbedDataSource = keyof TrafficEmbedSourceData;

export interface PublicTrafficEmbed {
  range: TrafficEmbedRange;
  from: string;
  to: string;
  /** The charts to draw, in page order. */
  charts: TrafficEmbedChart[];
  /** A source that failed to load is missing; its charts say so. */
  data: Partial<TrafficEmbedSourceData>;
  /** When the oldest number on the page was loaded (ISO). */
  updatedAt: string;
  /**
   * Changes when the stored charts or domains change, or a new deploy
   * serves the page; a long-running page reloads to pick those up.
   */
  revision: string;
  /**
   * The domains it may show on. They are public anyway, in the page's
   * frame-ancestors; an open page checks its parent against them so a
   * removed domain goes blank without waiting for a reload.
   */
  allowedOrigins: string[];
}

/** A cached source, with what decides whether it is still fresh. */
export interface TrafficEmbedCacheEntry {
  data: unknown;
  /** Epoch ms of the load. */
  at: number;
  /** The organization's check generation then; null when unknown. */
  generation: number | null;
}

/** What the page loader hands the embed page. */
export type TrafficEmbedLoadResult =
  | { status: "ok"; embed: PublicTrafficEmbed }
  | { status: "blocked" };

/** The browser-set request headers an embed request is judged by. */
export interface TrafficEmbedRequestContext {
  /** `page`: the embed document; `data`: the page's own polls. */
  kind: "page" | "data";
  /** `Sec-Fetch-Dest`, or null when the browser sends none. */
  dest: string | null;
  /** `Sec-Fetch-Site`, or null when the browser sends none. */
  site: string | null;
  referer: string | null;
  /** The dashboard's own origin, where the embed dialog previews it. */
  selfOrigin: string;
}

export type TrafficEmbedOriginResult =
  | { ok: true; origin: string }
  | { ok: false; value: string };
