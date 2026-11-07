import { postSlackNotification } from "@notra/ai/integrations/slack-workspace";
import { loadGeoOverviewForTool } from "@notra/ai/utils/geo-tool-data";
import {
  defineWorkflowBlock,
  halt,
  succeed,
} from "@notra/workflows/runtime/registry";
import { FatalError } from "workflow";

import {
  AUTOPILOT_WORKFLOW_BLOCK_TYPES,
  AUTOPILOT_WORKFLOW_DECIDE_PORTS,
  AUTOPILOT_WORKFLOW_OUT_OF_CREDITS,
  AUTOPILOT_WORKFLOW_STEP_INSTRUCTIONS,
} from "@/constants/autopilot-workflows";
import {
  runAutopilotAgentDecision,
  runAutopilotAgentText,
} from "@/lib/autopilot/workflows/agent";
import { loadIsOwnBrand } from "@/lib/autopilot/workflows/own-brands";
import {
  askAgentConfigSchema,
  decideConfigSchema,
  compareVisibilityConfigSchema,
  postToSlackConfigSchema,
} from "@/schemas/autopilot-workflows";
import { autopilotWorkflowAgentPrompt } from "@/utils/autopilot-workflows";

function geoSummary(params: {
  days: number;
  checks: number;
  mentions: number;
  leader: { brand: string; mentions: number } | null;
}) {
  const { days, checks, mentions, leader } = params;
  if (checks === 0) {
    return `No AI answers were checked in the last ${days} days.`;
  }
  const own = `In the last ${days} days AI engines mentioned you in ${mentions} of ${checks} answers.`;
  if (!leader) {
    return `${own} No competitor was mentioned.`;
  }
  return leader.mentions > mentions
    ? `${own} ${leader.brand} is ahead with ${leader.mentions} mentions.`
    : `${own} You lead; ${leader.brand} is next with ${leader.mentions} mentions.`;
}

export const customAutopilotBlocks = [
  defineWorkflowBlock({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.compareVisibility,
    kind: "task",
    title: "Compare AI visibility with competitors",
    description:
      "Counts how often AI engines mentioned the brand and each competitor. Output: days, checks, mentions, mentionRate (0 to 1), leader {brand, mentions} or null, behind (true when a competitor got more mentions), competitors, summary.",
    configSchema: compareVisibilityConfigSchema,
    run: async ({ organizationId, config }) => {
      const [overview, isOwnBrand] = await Promise.all([
        loadGeoOverviewForTool(organizationId, config.projectId, config.days),
        loadIsOwnBrand(organizationId, config.projectId),
      ]);
      // The share ranks every brand mentioned, the workspace's own included.
      const rivals = overview.competitor_share.filter(
        (row) => !isOwnBrand(row.brand)
      );
      const checks = overview.engines.reduce((sum, row) => sum + row.checks, 0);
      const mentions = overview.engines.reduce(
        (sum, row) => sum + row.mentions,
        0
      );
      const leader = rivals[0] ?? null;
      return succeed({
        days: config.days,
        checks,
        mentions,
        mentionRate: checks === 0 ? 0 : mentions / checks,
        leader,
        behind: leader !== null && leader.mentions > mentions,
        competitors: rivals.slice(0, 5),
        summary: geoSummary({ days: config.days, checks, mentions, leader }),
      });
    },
  }),
  defineWorkflowBlock({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.askAgent,
    kind: "ai",
    title: "Ask the agent",
    description:
      "Runs the agent with GEO data and web search on the instructions, which can embed earlier outputs. Output: text.",
    configSchema: askAgentConfigSchema,
    run: async ({ organizationId, config, node }) => {
      const text = await runAutopilotAgentText({
        organizationId,
        tag: "agent",
        instructions: AUTOPILOT_WORKFLOW_STEP_INSTRUCTIONS,
        prompt: autopilotWorkflowAgentPrompt({
          title: node.title,
          template: node.config?.instructions,
          resolved: config.instructions,
        }),
      });
      if (text === null) {
        // Fails the run, so it shows as failed with the reason.
        throw new FatalError(AUTOPILOT_WORKFLOW_OUT_OF_CREDITS);
      }
      return succeed({ text });
    },
  }),
  defineWorkflowBlock({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.decide,
    kind: "condition",
    title: "Let the agent decide",
    description:
      "Has the agent answer a yes or no question, then follows the yes or no branch. Output: answer, reason.",
    outputs: AUTOPILOT_WORKFLOW_DECIDE_PORTS,
    configSchema: decideConfigSchema,
    run: async ({ organizationId, config, node }) => {
      const decision = await runAutopilotAgentDecision({
        organizationId,
        tag: "decide",
        instructions: `${AUTOPILOT_WORKFLOW_STEP_INSTRUCTIONS} Decide the question with yes or no.`,
        prompt: autopilotWorkflowAgentPrompt({
          title: node.title,
          template: node.config?.question,
          resolved: config.question,
        }),
      });
      if (!decision) {
        throw new FatalError(AUTOPILOT_WORKFLOW_OUT_OF_CREDITS);
      }
      return succeed(decision, decision.answer ? "yes" : "no");
    },
  }),
  defineWorkflowBlock({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack,
    kind: "integration",
    title: "Post to Slack",
    description:
      "Posts the message, which can embed earlier outputs, to the one Slack channel the workspace picked for Notra in Settings; a workflow can't choose another channel. Output: delivered.",
    logo: "slack",
    configSchema: postToSlackConfigSchema,
    sideEffect: true,
    run: async ({ organizationId, config }) => {
      const delivered = await postSlackNotification(
        organizationId,
        config.message
      );
      return delivered
        ? succeed({ delivered })
        : halt("No connected Slack channel accepted the message", {
            delivered,
          });
    },
  }),
];
