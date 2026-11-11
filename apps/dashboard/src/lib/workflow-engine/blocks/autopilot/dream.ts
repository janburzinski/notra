import {
  defineWorkflowBlock,
  next,
  succeed,
} from "@notra/workflows/runtime/registry";
import type { WorkflowBlockStepContext } from "@notra/workflows/types/blocks";

import {
  checkDreamActivity,
  consolidateDream,
  dreamLogger,
  learnConventions,
  tidyMemory,
  verifyMemory,
  writeDailyNote,
} from "@/lib/autopilot/dream";
import { autopilotRunConfigSchema } from "@/schemas/autopilot-workflow";
import type { AutopilotRunContext } from "@/types/autopilot";
import type { AutopilotDreamBlockState as DreamState } from "@/types/autopilot-dream";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import type { AutopilotRunConfig } from "@/types/autopilot-workflow";
import { toErrorMessage } from "@/utils/error-message";

import { loadAutopilotContext } from "./shared";

type DreamContext = WorkflowBlockStepContext<AutopilotRunConfig, DreamState>;

const dreamStep = (
  id: string,
  title: string,
  work: (
    ctx: AutopilotRunContext,
    log: AutopilotLogger,
    context: DreamContext
  ) => Promise<Partial<DreamState>>,
  options: { sideEffect?: boolean } = {}
) => ({
  id,
  title,
  optional: true,
  sideEffect: options.sideEffect ?? false,
  run: async (context: DreamContext) => {
    const ctx = await loadAutopilotContext(context);
    const log = dreamLogger(ctx);
    try {
      return next<DreamState>(await work(ctx, log, context));
    } catch (error) {
      if (context.lastAttempt || options.sideEffect) {
        await log.error(`Dream: ${title.toLowerCase()} failed`, {
          error: toErrorMessage(error, String(error)),
        });
      }
      throw error;
    }
  },
});

export const dreamBlocks = [
  defineWorkflowBlock<typeof autopilotRunConfigSchema, DreamState>({
    type: "autopilot.dream",
    kind: "ai",
    title: "Dream",
    description: "Keeps Autopilot's memory true and tidy",
    configSchema: autopilotRunConfigSchema,
    steps: [
      {
        id: "check",
        title: "Check for activity",
        run: async (context: DreamContext) => {
          const ctx = await loadAutopilotContext(context);
          const log = dreamLogger(ctx);
          try {
            const activity = await checkDreamActivity(ctx);
            if (activity.reasons.length === 0) {
              await log.skip(
                "Dream: nothing happened since the last dream, so memory stays as it is",
                { since: activity.since }
              );
              return succeed({ skipped: true });
            }
            await log.info("Dream: tidying memory", {
              since: activity.since,
              reasons: activity.reasons,
            });
            return next<DreamState>({ since: activity.since });
          } catch (error) {
            if (context.lastAttempt) {
              await log.error("Dream: check for activity failed", {
                error: toErrorMessage(error, String(error)),
              });
            }
            throw error;
          }
        },
      },
      dreamStep(
        "consolidate",
        "Read closed pull requests",
        async (ctx, log) => ({
          consolidation: await consolidateDream(ctx, log),
        }),
        { sideEffect: true }
      ),
      dreamStep("learn", "Learn conventions", async (ctx, log, context) => ({
        learned: context.state.consolidation
          ? await learnConventions(ctx, log, context.state.consolidation)
          : [],
      })),
      dreamStep("tidy", "Tidy memory", async (ctx, log, context) => ({
        tidied: await tidyMemory(
          ctx,
          log,
          context.state.consolidation?.merges ?? []
        ),
      })),
      dreamStep(
        "verify",
        "Check memory against data",
        async (ctx, log, context) => ({
          verified: await verifyMemory(ctx, log, context.state.since ?? null),
        })
      ),
      dreamStep("note", "Write the daily note", async (ctx, log, context) => {
        await writeDailyNote(ctx, log, {
          since: context.state.since ?? null,
          report: {
            reviewed:
              context.state.consolidation?.reviewed.map(
                (row) => row.pullRequest
              ) ?? [],
            learned: context.state.learned ?? [],
            tidied: context.state.tidied ?? [],
            verified: context.state.verified ?? [],
          },
        });
        return {};
      }),
    ],
  }),
];
