import type { PostAgentReachToolConfig } from "@notra/ai/types/post-agent-reach";
import { toolDescription } from "@notra/ai/utils/description";
import { findPostByIdentifier } from "@notra/ai/utils/post-lookup";
import { type Tool, tool } from "ai";
import { z } from "zod";

export function createGetPostAgentReachTool(
  config: PostAgentReachToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getPostAgentReach",
      intro:
        "Gets a post's agent reach: AI crawler, citation and referral visits to its live page on its Notra Site, including its Markdown copy.",
      whenToUse:
        "Use when the user asks how a specific post does with AI engines, which AI bots read it, or whether ChatGPT, Perplexity or others send people to it.",
      usageNotes:
        "Pass a post id, slug, or exact title. live: false means the post isn't published to a Site; say so instead of reporting zero.",
    }),
    inputSchema: z.object({
      identifier: z
        .string()
        .min(1)
        .describe("The ID, slug, or exact title of the post"),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Number of trailing days to include."),
    }),
    execute: async ({ identifier, days }) => {
      const lookup = await findPostByIdentifier(
        config.organizationId,
        identifier
      );
      if (lookup.status === "ambiguous") {
        return {
          post: null,
          found: false,
          message:
            "Several posts have that title. Pass the post ID or slug instead.",
        };
      }
      if (lookup.status === "missing") {
        return { post: null, found: false };
      }
      const { post } = lookup;
      const reach = await config.loadPostAgentReach({
        organizationId: config.organizationId,
        postId: post.id,
        days,
      });
      return { post, found: true, days, ...reach };
    },
  });
}
