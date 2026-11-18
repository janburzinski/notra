import type { ReactNode } from "react";

import type { PricingPlan } from "@/types/landing/pricing";

type FeatureEngine = "chatgpt" | "claude" | "gemini" | "perplexity";

type FeatureRank = number | null;

interface FeatureDetailFact {
  title: string;
  description: string;
}

interface FeatureDetailMeta {
  path: string;
  title: string;
  description: string;
  ogImageKey: "personas" | "conversations" | "aiCrawlerLogs" | "features";
}

export interface FeatureDetailCopy {
  meta: FeatureDetailMeta;
  heroSubtitle: string;
  signupSource: string;
  overview: {
    heading: string;
    description: string;
    facts: FeatureDetailFact[];
  };
  steps: {
    heading: string;
    items: FeatureDetailFact[];
  };
  cta: {
    heading: string;
    subcopy: string;
  };
}

export interface FeatureDetailPageProps {
  copy: FeatureDetailCopy;
  title: ReactNode;
  stage: ReactNode;
  heroActions?: ReactNode;
  overviewVisual?: ReactNode;
  overviewVisualFirst?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  heroSecondaryCta?: FeatureDetailLink;
  pricingPlans?: PricingPlan[];
}

export interface FeatureDetailLink {
  label: string;
  href: string;
}

export interface FeaturePersona {
  name: string;
  role: string;
  avatar: string;
}

export interface FeaturePersonaCard extends FeaturePersona {
  remembers: string;
  rank: FeatureRank;
}

export interface FeaturePersonaVisibilityRow extends FeaturePersona {
  ranks: Record<FeatureEngine, FeatureRank>;
  visibility: string;
}

export interface FeatureConversationTurn {
  question: string;
  searched: string;
  answer: string;
  rank: FeatureRank;
}

export interface FeatureConversationEngineRow extends FeatureEngineLabel {
  ranks: FeatureRank[];
  mentioned: string;
  muted?: boolean;
}

export type FeatureCrawlerReason =
  | "Training"
  | "Search index"
  | "Live answer"
  | "Referral";

export interface FeatureCrawlerReasonTotal {
  reason: FeatureCrawlerReason;
  count: string;
  share: number;
}

export interface FeatureCrawlerPageRow {
  path: string;
  counts: [string | null, string | null, string | null];
  lastVisit: string;
}

export interface FeatureEngineIconProps {
  engine: FeatureEngine;
  className?: string;
  adaptive?: boolean;
}

export interface FeatureRankBadgeProps {
  rank: FeatureRank;
  size?: "sm" | "md";
}

export interface FeatureEngineLabel {
  engine: FeatureEngine;
  label: string;
}

export interface FeatureStageImage {
  src: string;
  author: string;
  authorUrl: string;
  photoUrl: string;
  /** Where the photo is from. Defaults to Pixabay. */
  source?: string;
}

export interface FeatureStageShellProps {
  className?: string;
  image?: FeatureStageImage;
  children: ReactNode;
}

export interface FeatureTableCardProps {
  title: string;
  meta: string;
  minWidthClass: string;
  columns: ReactNode;
  head: ReactNode;
  children: ReactNode;
}

export interface FeatureFreeScanRow {
  prompt: string;
  rank: FeatureRank;
  leader: string;
}

export interface FeatureFreeScanStat {
  label: string;
  value: string;
}
