export interface CollectionAgentReach {
  crawler: number;
  aiReferral: number;
  total: number;
  /** Posts in the collection that are live on a Site. */
  posts: number;
  /** A query failed, so the totals would undercount. */
  unavailable: boolean;
}

export interface ContentAgentReachProps {
  organizationId: string;
  contentId: string;
}

export interface AgentReachCellProps {
  reach: CollectionAgentReach | undefined;
  loading: boolean;
  /** The whole lookup failed, so a missing entry doesn't mean "not live". */
  failed: boolean;
}

export type AgentReachKind = "crawled" | "cited" | "referred";

/** One AI company with its visits split by kind, e.g. OpenAI. */
export interface AgentReachEngine extends Record<AgentReachKind, number> {
  key: string;
  label: string;
  icon: string;
  total: number;
}

export interface AgentReachEngineRowProps {
  engine: AgentReachEngine;
  max: number;
}

export interface AgentReachStatsProps {
  totals: Record<AgentReachKind, number>;
  trends: Record<AgentReachKind, number[]>;
}
