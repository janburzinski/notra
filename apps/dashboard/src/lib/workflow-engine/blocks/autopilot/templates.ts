import {
  defineWorkflowBlock,
  halt,
  next,
  requireStepState,
  succeed,
} from "@notra/workflows/runtime/registry";
import type { WorkflowBlockStep } from "@notra/workflows/types/blocks";

import { pickComparison } from "@/lib/autopilot/comparisons";
import {
  checkRefresh,
  claimRefresh,
  openRefreshPullRequest,
  writeRefresh,
} from "@/lib/autopilot/refresh";
import {
  checkRendering,
  claimRenderingFix,
  openRenderingPullRequest,
  writeRenderingFix,
} from "@/lib/autopilot/rendering";
import { autopilotRunConfigSchema } from "@/schemas/autopilot-workflow";
import type {
  AutopilotRunConfig,
  RefreshState,
  RenderingState,
} from "@/types/autopilot-workflow";

import {
  holdAutopilotCredits,
  loadAutopilotContext,
  settleClaimedDraft,
  stepClaimToken,
  withRunLease,
} from "./shared";

function creditsStep<
  State extends RefreshState | RenderingState,
>(): WorkflowBlockStep<AutopilotRunConfig, State> {
  return {
    id: "credits",
    title: "Hold credits",
    run: async (context) => {
      const { claim } = requireStepState(context.state, "claim");
      const held = await holdAutopilotCredits({
        ctx: await loadAutopilotContext(context),
        claim,
        whenUnavailable: "fail",
      });
      return "reservation" in held
        ? next<State>({ reservation: held.reservation } as Partial<State>)
        : halt(held.reason, { findingId: claim.finding.id });
    },
  };
}

export const templateBlocks = [
  defineWorkflowBlock<typeof autopilotRunConfigSchema, RefreshState>({
    type: "autopilot.refresh",
    kind: "integration",
    title: "Refresh pages AI stopped citing",
    logo: "github",
    configSchema: autopilotRunConfigSchema,
    steps: [
      {
        id: "check",
        title: "Find pages AI cites less",
        run: async (context) => {
          const ctx = await loadAutopilotContext(context);
          const result = await withRunLease(ctx, () => checkRefresh(ctx));
          if (!result) {
            return halt("This run no longer owns its lease");
          }
          if (!result.ready) {
            return halt(result.reason);
          }
          const { ready: _ready, ...check } = result;
          return next({ check });
        },
      },
      {
        id: "claim",
        title: "Claim the page",
        run: async (context) => {
          const { check } = requireStepState(context.state, "check");
          const claimed = await claimRefresh({
            ctx: await loadAutopilotContext(context),
            check,
            claimToken: stepClaimToken(context),
          });
          return "claim" in claimed
            ? next({ claim: claimed.claim })
            : halt(claimed.reason);
        },
      },
      creditsStep<RefreshState>(),
      {
        id: "write",
        title: "Audit and edit the page",
        sideEffect: true,
        run: async (context) => {
          const { claim, check } = requireStepState(
            context.state,
            "claim",
            "check"
          );
          const written = await writeRefresh({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
          });
          return next({ fix: written.fix, usage: [written.usage] });
        },
      },
      {
        id: "pull-request",
        title: "Open the pull request",
        sideEffect: true,
        run: async (context) => {
          const { claim, check } = requireStepState(
            context.state,
            "claim",
            "check"
          );
          const fix = context.state.fix ?? null;
          if (!fix) {
            return halt("The page already answers what the engines look for", {
              findingId: claim.finding.id,
            });
          }
          const pullRequest = await openRefreshPullRequest({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
            fix,
          });
          return succeed({ findingId: claim.finding.id, ...pullRequest });
        },
      },
    ],
    finally: settleClaimedDraft,
  }),
  defineWorkflowBlock<typeof autopilotRunConfigSchema, RenderingState>({
    type: "autopilot.rendering",
    kind: "integration",
    title: "Make pages readable for AI",
    logo: "github",
    configSchema: autopilotRunConfigSchema,
    steps: [
      {
        id: "check",
        title: "Fetch pages like an AI crawler",
        run: async (context) => {
          const ctx = await loadAutopilotContext(context);
          const check = await withRunLease(ctx, () => checkRendering(ctx));
          if (!check) {
            return halt("This run no longer owns its lease");
          }
          // Blocked crawlers can't be fixed in the repository; the brief says so.
          return check.ready
            ? next({ check })
            : halt(check.reason, { insights: check.insights });
        },
      },
      {
        id: "claim",
        title: "Claim the fix",
        run: async (context) => {
          const { check } = requireStepState(context.state, "check");
          const claimed = await claimRenderingFix({
            ctx: await loadAutopilotContext(context),
            check,
            claimToken: stepClaimToken(context),
          });
          return "claim" in claimed
            ? next({ claim: claimed.claim })
            : halt(claimed.reason, { insights: check.insights });
        },
      },
      creditsStep<RenderingState>(),
      {
        id: "write",
        title: "Render the content on the server",
        sideEffect: true,
        run: async (context) => {
          const { claim, check } = requireStepState(
            context.state,
            "claim",
            "check"
          );
          const fix = await writeRenderingFix({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
          });
          return next({ fix, usage: [fix.usage] });
        },
      },
      {
        id: "pull-request",
        title: "Open the pull request",
        sideEffect: true,
        run: async (context) => {
          const { claim, check, fix } = requireStepState(
            context.state,
            "claim",
            "check",
            "fix"
          );
          if (fix.files.length === 0) {
            return halt("The cause is outside the repository", {
              findingId: claim.finding.id,
              insights: [
                ...check.insights,
                `AI crawlers miss content on ${check.problems.map((problem) => problem.url).join(", ")}, and the cause is outside the website repository: ${fix.skipped.map((skip) => skip.reason).join("; ") || "no repository change renders it on the server"}.`,
              ],
            });
          }
          const pullRequest = await openRenderingPullRequest({
            ctx: await loadAutopilotContext(context),
            claim,
            check,
            fix,
          });
          return succeed({
            findingId: claim.finding.id,
            insights: check.insights,
            ...pullRequest,
          });
        },
      },
    ],
    finally: settleClaimedDraft,
  }),
  defineWorkflowBlock({
    type: "autopilot.comparisons",
    kind: "task",
    title: "Pick a comparison page",
    configSchema: autopilotRunConfigSchema,
    run: async (context) => {
      const ctx = await loadAutopilotContext(context);
      const pick = await withRunLease(ctx, () => pickComparison(ctx));
      if (!pick) {
        return halt("This run no longer owns its lease");
      }
      if (!pick.ready) {
        return halt(pick.reason);
      }
      const { ready: _ready, ...proposal } = pick;
      return succeed(proposal);
    },
  }),
];
