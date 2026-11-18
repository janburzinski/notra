import type { ComponentType, SVGProps } from "react";
import type { Messages } from "use-intl";

export type EngineId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "grok"
  | "kimi";

export type LandingEngineId = EngineId | "claude-code" | "glm";

export type LandingEngineIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface LandingEngineIconProps {
  engine: LandingEngineId;
  className?: string;
}

export interface EngineRateRow {
  id: EngineId;
  mentionRate: number;
  mentions: number;
  checks: number;
  avgPosition: number;
  lastCheckedHours: number;
}

export interface ShareRowLogo {
  src: string;
  darkSrc?: string;
  invertOnDark?: boolean;
  tileOnDark?: boolean;
}

export interface ShareRow {
  id: string;
  brand: string;
  logo: ShareRowLogo;
  share: number;
  mentions: number;
  color: string;
  isYou?: boolean;
}

export interface KpiTile {
  id: Extract<keyof Messages["landing"]["features"]["traffic"]["kpis"], string>;
  value: number;
}

type TrafficPurpose =
  | "training-crawler"
  | "search-index"
  | "assistant-browse"
  | "assistant-referral";

export interface CitationRow {
  id: string;
  agoSeconds: number;
  provider: string;
  engine: LandingEngineId;
  path: string;
  purpose: TrafficPurpose;
  markdown?: boolean;
}

export interface LiveCitationRow extends CitationRow {
  offsetMs: number;
}

export interface LiveTrafficProvider {
  provider: string;
  engine: LandingEngineId;
  purposes: TrafficPurpose[];
}

export interface CitationRowsProps {
  rows: LiveCitationRow[];
  base: number | null;
  animated: boolean;
  enteringId?: string | null;
  onEntered?: (id: string) => void;
  headers: { when: string; provider: string; path: string; purpose: string };
}

export interface TrafficSourceRow {
  id: string;
  source: string;
  engine: LandingEngineId;
  purpose: TrafficPurpose;
  visits: number;
  lastSeenSeconds: number;
}

export interface GapRow {
  id: Extract<keyof Messages["landing"]["features"]["gaps"]["rows"], string>;
  opportunity: number;
  mentionRate: number;
  missing: EngineId[];
}

export type AnswerSentiment = "positive" | "neutral" | "negative";

export type AnswerPositionTone = "top" | "mid" | "low";

type AnswerExampleMessages = Messages["landing"]["answers"];

export type AnswerExampleEngineId = Extract<
  keyof AnswerExampleMessages["excerpts"],
  EngineId
>;

export type AnswerExampleFactId = Extract<
  keyof AnswerExampleMessages["facts"],
  string
>;

export interface AnswerEngineResult {
  id: AnswerExampleEngineId;
  mentioned: boolean;
  position: number | null;
  sentiment: AnswerSentiment;
}
