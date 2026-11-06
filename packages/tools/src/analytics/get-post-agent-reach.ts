import { findPostByIdentifier } from "@notra/ai/utils/post-lookup";
import { logError } from "@notra/ai/utils/server-log";
import { loadPostAgentReachSummary } from "@notra/geo-core/geo/post-agent-reach";
import { defineTool } from "eve/tools";

import {
  POST_AGENT_REACH_QUERY_FAILED_MESSAGE,
  POST_IDENTIFIER_AMBIGUOUS_MESSAGE,
} from "../constants/analytics";
import { getPostAgentReachInputSchema } from "../schemas/analytics-tools";
import { resolveAnalyticsRange } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetPostAgentReachTool() {
  return defineTool({
    description:
      "Get a post's agent reach: AI crawler, citation and referral visits to the post's live page on its Notra Site, including its Markdown copy. Use when the user asks how a specific post performs with AI engines, which AI bots read it, or whether ChatGPT, Perplexity or others send people to it. Pass the post ID, slug or exact title. Returns live: false when the post isn't published to a Site.",
    inputSchema: getPostAgentReachInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const range = resolveAnalyticsRange(input);
      if (typeof range === "string") {
        return range;
      }
      const lookup = await findPostByIdentifier(
        organizationId,
        input.identifier
      );
      if (lookup.status === "ambiguous") {
        return POST_IDENTIFIER_AMBIGUOUS_MESSAGE;
      }
      if (lookup.status === "missing") {
        return { post: null, found: false };
      }
      const { post } = lookup;
      try {
        const reach = await loadPostAgentReachSummary({
          organizationId,
          postId: post.id,
          from: range.from,
          to: range.to,
        });
        return { post, found: true, range, ...reach };
      } catch (error) {
        logError("[Tools] get_post_agent_reach failed", error);
        return POST_AGENT_REACH_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
