import { postSlackNotification } from "@notra/ai/integrations/slack-workspace";
import { loadGeoOverviewForTool } from "@notra/ai/utils/geo-tool-data";
import {
  defineWorkflowBlock,
  halt,
  next,
  requireStepState,
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
import {
  AutopilotLinkCheckUnavailableError,
  checkCollectedLinks,
  collectSiteLinks,
} from "@/lib/autopilot/workflows/check-links";
import { loadIsOwnBrand } from "@/lib/autopilot/workflows/own-brands";
import {
  collectAutopilotPromptScan,
  startAutopilotPromptScan,
} from "@/lib/autopilot/workflows/scan-prompt";
import {
  askAgentConfigSchema,
  checkLinksConfigSchema,
  decideConfigSchema,
  compareVisibilityConfigSchema,
  postToSlackConfigSchema,
  scanPromptConfigSchema,
} from "@/schemas/autopilot-workflows";
import type { AutopilotLinkCheckState } from "@/types/autopilot-link-check";
import type { AutopilotPromptScanState } from "@/types/autopilot-workflows";
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
  defineWorkflowBlock<typeof scanPromptConfigSchema, AutopilotPromptScanState>({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.scanPrompt,
    kind: "task",
    title: "Scan a prompt",
    description:
      "Asks AI engines one tracked prompt again now, on every engine the project tracks or only the engines listed (one engine is fine), and waits up to 4 minutes for the answers. Uses the workspace's AI answers like a rescan in GEO. Output: scanId, status (running, completed or failed), finished (false when engines were still answering at the deadline), prompt, engines, checks, mentions, mentionRate (0 to 1), results [{engine, language, mentioned, position, competitors, excerpt}], summary.",
    configSchema: scanPromptConfigSchema,
    steps: [
      {
        id: "start",
        title: "Start the scan",
        // Not a side effect, so a failed start retries. A repeat can't start or
        // bill the scan twice: after a started or ambiguous hand-off the
        // project's scan claim is still held, so it halts as already running.
        run: async ({ organizationId, config }) => {
          const started = await startAutopilotPromptScan({
            organizationId,
            projectId: config.projectId,
            promptId: config.promptId,
            engines: config.engines,
          });
          if (started.ok) {
            return next({ scanId: started.scanId, prompt: started.prompt });
          }
          if (started.outcome === "halt") {
            return halt(started.reason);
          }
          if (started.outcome === "fail") {
            throw new FatalError(started.reason);
          }
          throw new Error(started.reason);
        },
      },
      {
        id: "collect",
        title: "Wait for the answers",
        run: async ({ organizationId, state }) => {
          const { scanId, prompt } = requireStepState(
            state,
            "scanId",
            "prompt"
          );
          const scan = await collectAutopilotPromptScan({
            organizationId,
            scanId,
            prompt,
          });
          if (!scan) {
            throw new FatalError("The scan was deleted before it finished");
          }
          if (scan.status === "failed" && scan.checks === 0) {
            throw new FatalError(scan.summary);
          }
          return succeed(scan);
        },
      },
    ],
  }),
  defineWorkflowBlock<typeof checkLinksConfigSchema, AutopilotLinkCheckState>({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.checkLinks,
    kind: "task",
    title: "Check site links",
    description:
      "Reads the project's website (the homepage and up to maxPages pages from its sitemap) and requests every link on them, to the site itself and to other sites. Only links that answer 404 or 410 count as broken; ones that time out or answer a server error are listed apart as unreachable. Also lists the paths real visitors opened that answered 404 over the last days, when the site sends web analytics. Takes a few minutes and costs no credits. To act only when something is broken, follow it with a core.if on brokenCount (operator gt, value 0), not an agent step. Output: site, pagesChecked, linksChecked, brokenCount, broken [{url, status, internal, foundOn}], unreachableCount, unreachable [{url, internal, foundOn}], missingPages [{path, views}], summary (one sentence), report (summary plus the lists, ready to post to Slack).",
    configSchema: checkLinksConfigSchema,
    steps: [
      {
        id: "collect",
        title: "Read the site",
        run: async ({ organizationId, config }) => {
          try {
            return next<AutopilotLinkCheckState>(
              await collectSiteLinks({
                organizationId,
                projectId: config.projectId,
                maxPages: config.maxPages,
                days: config.days,
              })
            );
          } catch (error) {
            if (error instanceof AutopilotLinkCheckUnavailableError) {
              return halt(error.message);
            }
            throw error;
          }
        },
      },
      {
        id: "check",
        title: "Check the links",
        run: async ({ state }) => {
          requireStepState(state, "site", "links");
          return succeed(
            await checkCollectedLinks(state as AutopilotLinkCheckState)
          );
        },
      },
    ],
  }),
  defineWorkflowBlock({
    type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.askAgent,
    kind: "ai",
    title: "Ask the agent",
    description:
      "Runs the agent with GEO data and web search on the instructions, which can embed earlier outputs. Output: text.",
    configSchema: askAgentConfigSchema,
    sideEffect: true,
    run: async ({ organizationId, config, idempotencyKey, node }) => {
      const text = await runAutopilotAgentText({
        organizationId,
        idempotencyKey,
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
    sideEffect: true,
    run: async ({ organizationId, config, idempotencyKey, node }) => {
      const decision = await runAutopilotAgentDecision({
        organizationId,
        idempotencyKey,
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
