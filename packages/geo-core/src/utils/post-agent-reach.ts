import { POST_AGENT_REACH_TOOL_SOURCE_LIMIT } from "../constants/geo";
import type { GeoTrafficSource } from "../types/geo";
import type {
  PostAgentReach,
  PostAgentReachToolResult,
} from "../types/post-agent-reach";
import { formatGeoSource, isCitedTrafficSource } from "./ai-traffic";

function postAgentReachKind(
  source: GeoTrafficSource
): "crawled" | "cited" | "referred" {
  if (source.visitorType === "ai_referral") {
    return "referred";
  }
  return isCitedTrafficSource(source) ? "cited" : "crawled";
}

/** Compact agent reach for AI tools: totals and the busiest engines. */
export function summarizePostAgentReach(
  reach: PostAgentReach | null
): PostAgentReachToolResult {
  if (!reach) {
    return {
      live: false,
      message:
        "This post isn't live on a Notra Site, so it has no agent reach. Reach is tracked once a post is published to a Site's production branch and the Site is deployed.",
    };
  }
  return {
    live: true,
    url: reach.url,
    path: reach.path,
    configured: reach.configured,
    totals: reach.totals,
    sources: [...reach.sources]
      .sort((left, right) => right.visits - left.visits)
      .slice(0, POST_AGENT_REACH_TOOL_SOURCE_LIMIT)
      .map((source) => ({
        engine: formatGeoSource(source.source),
        agent: source.agent || null,
        kind: postAgentReachKind(source),
        visits: source.visits,
        lastSeenAt: source.lastSeenAt,
      })),
  };
}
