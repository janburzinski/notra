import { GEO_TRAFFIC_GROUPS_BY_ENGINE } from "@notra/geo-core/constants/geo";
import type {
  PostAgentReach,
  PostAgentReachSummary,
} from "@notra/geo-core/types/post-agent-reach";
import {
  isCitedTrafficSource,
  trafficDayKey,
} from "@notra/geo-core/utils/ai-traffic";
import { resolveEngineIconKey } from "@notra/geo-core/utils/geo-engine-icon";

import type {
  AgentReachEngine,
  AgentReachKind,
  CollectionAgentReach,
} from "@/types/content/agent-reach";

const DAY_MS = 86_400_000;

/** Visits per AI company, busiest first; ChatGPT referrals count as OpenAI. */
export function agentReachEngines(reach: PostAgentReach): AgentReachEngine[] {
  const engines = new Map<string, AgentReachEngine>();
  for (const source of reach.sources) {
    const iconKey = resolveEngineIconKey(source.source);
    const group = iconKey ? GEO_TRAFFIC_GROUPS_BY_ENGINE[iconKey] : undefined;
    const key = group?.key ?? source.source;
    const engine = engines.get(key) ?? {
      key,
      label: group?.label ?? source.source,
      icon: group?.icon ?? source.source,
      crawled: 0,
      cited: 0,
      referred: 0,
      total: 0,
    };
    engine[agentReachKind(source)] += source.visits;
    engine.total += source.visits;
    engines.set(key, engine);
  }
  return [...engines.values()].sort(
    (left, right) =>
      right.total - left.total || left.label.localeCompare(right.label)
  );
}

function agentReachKind(
  source: PostAgentReach["sources"][number]
): AgentReachKind {
  if (source.visitorType === "ai_referral") {
    return "referred";
  }
  return isCitedTrafficSource(source) ? "cited" : "crawled";
}

/**
 * Daily visits per kind from `days` UTC days ago through today, oldest first,
 * matching the traffic query's inclusive `day >= today - days` window.
 */
export function agentReachDailyVisitsByKind(
  reach: Pick<PostAgentReach, "points" | "sources">,
  days: number,
  now = new Date()
): Record<AgentReachKind, number[]> {
  const kindBySource = new Map(
    reach.sources.map((source) => [
      `${source.visitorType}:${source.source}`,
      agentReachKind(source),
    ])
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const length = days + 1;
  const dayIndex = new Map(
    Array.from({ length }, (_, index) => [
      new Date(today - (days - index) * DAY_MS).toISOString().slice(0, 10),
      index,
    ])
  );
  const series: Record<AgentReachKind, number[]> = {
    crawled: Array.from({ length }, () => 0),
    cited: Array.from({ length }, () => 0),
    referred: Array.from({ length }, () => 0),
  };
  for (const point of reach.points) {
    const index = dayIndex.get(trafficDayKey(point.day));
    const kind =
      kindBySource.get(`${point.visitorType}:${point.source}`) ??
      (point.visitorType === "ai_referral" ? "referred" : null);
    if (index === undefined || kind === null) {
      continue;
    }
    series[kind][index] = (series[kind][index] ?? 0) + point.visits;
  }
  return series;
}

/** Sums a daily series into buckets of `size` days, ending on today. */
export function bucketAgentReachTrend(
  values: readonly number[],
  size: number
): number[] {
  const buckets: number[] = [];
  for (let end = values.length; end > 0; end -= size) {
    const start = Math.max(0, end - size);
    buckets.unshift(
      values.slice(start, end).reduce((total, value) => total + value, 0)
    );
  }
  return buckets;
}

export function sumAgentReachByCollection(
  collectionPosts: readonly { id: string; collectionId: string }[],
  summaries: readonly PostAgentReachSummary[]
): Record<string, CollectionAgentReach> {
  const byPost = new Map(summaries.map((summary) => [summary.postId, summary]));
  const byCollection: Record<string, CollectionAgentReach> = {};
  for (const post of collectionPosts) {
    const summary = byPost.get(post.id);
    if (!summary) {
      continue;
    }
    const current = byCollection[post.collectionId] ?? {
      crawler: 0,
      aiReferral: 0,
      total: 0,
      posts: 0,
      unavailable: false,
    };
    byCollection[post.collectionId] = {
      crawler: current.crawler + summary.crawler,
      aiReferral: current.aiReferral + summary.aiReferral,
      total: current.total + summary.total,
      posts: current.posts + 1,
      unavailable: current.unavailable || !summary.available,
    };
  }
  return byCollection;
}
