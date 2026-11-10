import type {
  AiTrafficResponse,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";

export type TrafficEmbedRange = "7d" | "14d" | "30d" | "90d";

export type TrafficEmbedTheme = "light" | "dark" | "auto";

export type TrafficEmbedPart = "metrics" | "chart";

/** AI agent traffic or web visitors, matching the Analytics source tabs. */
export type TrafficEmbedSource = "agents" | "web";

export interface TrafficEmbedSummary {
  id: string;
  name: string;
  projectId: string | null;
  host: string | null;
  source: TrafficEmbedSource;
  allowedOrigins: string[];
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
}

/** The web summary an embed shows; no pages, sources or hosts leave Notra. */
type PublicWebTraffic = Pick<
  WebAnalyticsResponse,
  "totals" | "points" | "imported"
>;

interface PublicTrafficEmbedBase {
  range: TrafficEmbedRange;
  from: string;
  to: string;
}

export type PublicTrafficEmbed = PublicTrafficEmbedBase &
  (
    | { source: "agents"; traffic: AiTrafficResponse }
    | { source: "web"; web: PublicWebTraffic }
  );

export type TrafficEmbedOriginResult =
  | { ok: true; origin: string }
  | { ok: false; value: string };
