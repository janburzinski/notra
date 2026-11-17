import { calculateAiCreditCostCents } from "@notra/ai/billing/ai-credit-cost";
import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { calculateTokenCostUsd } from "@notra/ai/billing/token-pricing";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { captureServerEvent, flushPostHogServer } from "@notra/posthog/server";
import { getOrganizationId } from "@notra/tools/utils/organization";
import {
  getBooleanSessionAttribute,
  getSessionAttribute,
} from "@notra/tools/utils/session";
import { runs } from "eve/events";
import {
  defineHook,
  type HookContext,
  type HookDefinition,
  type HookEvent,
} from "eve/hooks";

import {
  ACCUMULATE_USAGE_SCRIPT,
  MICRO_USD_PER_USD,
  USAGE_KEY_TTL_SECONDS,
} from "../constants/usage";
import type { AccumulatedUsage } from "../types/usage";

function accumulatorKey(sessionId: string, turnId: string) {
  return `agent:usage:acc:${sessionId}:${turnId}`;
}

function billedKeyFor(sessionId: string, turnId: string) {
  return `agent:usage:billed:${sessionId}:${turnId}`;
}

function usageProperties(
  ctx: HookContext,
  turnId: string
): Record<string, string | number> {
  return {
    source: getSessionAttribute(ctx, "surface") ?? "agent",
    agent: ctx.agent.name,
    session_id: ctx.session.id,
    turn_id: turnId,
    markup_applied: getBooleanSessionAttribute(ctx, "useMarkup")
      ? "true"
      : "false",
  };
}

async function trackUsage(
  modelId: string,
  organizationId: string,
  usage: AccumulatedUsage,
  properties: Record<string, string | number>
) {
  if (!autumn) {
    return;
  }
  const totalTokens =
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadTokens +
    usage.cacheWriteTokens;
  if (totalTokens === 0 && !usage.costMicroUsd) {
    return;
  }
  const cost = calculateAiCreditCostCents(
    {
      ...usage,
      totalTokens,
      modelId,
      ...(usage.costMicroUsd === undefined
        ? {}
        : { tokenCostUsd: usage.costMicroUsd / MICRO_USD_PER_USD }),
    },
    modelId,
    properties.markup_applied === "true"
  );
  await autumn.track({
    customerId: organizationId,
    featureId: FEATURES.AI_CREDITS,
    value: cost.costCents,
    properties: {
      ...properties,
      model: modelId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cache_read_tokens: usage.cacheReadTokens,
      cache_write_tokens: usage.cacheWriteTokens,
      cost_cents: cost.costCents,
    },
  });
  try {
    captureServerEvent({
      event: POSTHOG_EVENTS.AI_CREDITS_CHARGED,
      organizationId,
      properties: {
        cost_cents: cost.costCents,
        source: properties.source,
        model: modelId,
        billing_basis: cost.billingBasis,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cache_read_tokens: usage.cacheReadTokens,
        cache_write_tokens: usage.cacheWriteTokens,
        total_tokens: totalTokens,
        agent: properties.agent,
        turn_id: properties.turn_id,
        markup_applied: properties.markup_applied === "true",
      },
    });
    await flushPostHogServer();
  } catch (error) {
    logError("[agent] Charged usage telemetry failed", error, {
      sessionId: properties.session_id,
      turnId: properties.turn_id,
    });
  }
}

/**
 * The model runs v26 billed through `step.completed`: the session's own
 * completed model calls in a turn. Skips usage eve records for retried or
 * abandoned attempts, compaction summaries (owned by a context change), tool
 * side calls such as `decide()`, and spend a child session reports back to
 * its parent, which the child's own usage hook already bills.
 */
function billableModelRun(
  event: HookEvent<"usage.recorded">,
  ctx: HookContext<"usage.recorded">
): { runId: string; turnId: string } | null {
  const { kind, owner } = event.data;
  if (kind !== "model" || !(owner && "runId" in owner)) {
    return null;
  }
  if (event.scope?.changeId) {
    return null;
  }
  const run = runs(ctx.view).find((item) => item.runId === owner.runId);
  if (run && !(run.status === "settled" && run.outcome === "completed")) {
    return null;
  }
  const turnId = event.scope?.turnId ?? run?.turnId ?? ctx.turn?.id;
  return turnId ? { runId: owner.runId, turnId } : null;
}

function shouldChargeAiCredits(ctx: Parameters<typeof getSessionAttribute>[0]) {
  return getSessionAttribute(ctx, "chargeAiCredits") !== "false";
}

export function createUsageHook(
  modelId: string | ((turnId: string) => string)
): HookDefinition {
  const resolveModelId = (turnId: string) =>
    typeof modelId === "string" ? modelId : modelId(turnId);

  async function settleTurn(
    event: HookEvent<"turn.settled">,
    ctx: HookContext<"turn.settled">
  ) {
    const key = accumulatorKey(ctx.session.id, event.data.turnId);
    const billedKey = billedKeyFor(ctx.session.id, event.data.turnId);
    const billingKey = `${key}:billing`;
    let claimed = false;
    let trackingStarted = false;
    let charged = false;
    try {
      if (
        !redis ||
        !autumn ||
        allowUnmeteredAiInDevelopment ||
        !shouldChargeAiCredits(ctx)
      ) {
        return;
      }
      const organizationId = getOrganizationId(ctx);
      if (!organizationId) {
        return;
      }
      claimed =
        (await redis.set(billedKey, "1", {
          nx: true,
          ex: USAGE_KEY_TTL_SECONDS,
        })) === "OK";
      if (!claimed) {
        return;
      }
      if (await redis.exists(billingKey)) {
        await redis.persist(billingKey);
        logError("[agent] Usage billing reconciliation required", undefined, {
          sessionId: ctx.session.id,
          turnId: event.data.turnId,
          billingKey,
          reason: "pending_billing_record",
          automaticRetry: false,
        });
        return;
      }
      if (!(await redis.exists(key))) {
        await redis.del(billedKey);
        return;
      }
      await redis.rename(key, billingKey);
      // Keep evidence past the claim's TTL. There is no documented Autumn
      // idempotency contract: an interrupted/rejected track must be reconciled
      // manually, never automatically retried by another terminal event.
      // No durable reconciliation path exists yet; neither this claim nor
      // the pending record guarantees exactly-once billing.
      await redis.persist(billingKey);
      const accumulated =
        await redis.hgetall<Record<string, string>>(billingKey);
      if (!accumulated) {
        throw new Error("Frozen usage billing record is missing");
      }
      trackingStarted = true;
      await trackUsage(
        resolveModelId(event.data.turnId),
        organizationId,
        {
          inputTokens: Number(accumulated.inputTokens ?? 0),
          outputTokens: Number(accumulated.outputTokens ?? 0),
          cacheReadTokens: Number(accumulated.cacheReadTokens ?? 0),
          cacheWriteTokens: Number(accumulated.cacheWriteTokens ?? 0),
          costMicroUsd:
            accumulated.costMicroUsd === undefined
              ? undefined
              : Number(accumulated.costMicroUsd),
        },
        usageProperties(ctx, event.data.turnId)
      );
      charged = true;
      await redis.del(billingKey);
    } catch (error) {
      logError(
        trackingStarted && !charged
          ? "[agent] Usage billing reconciliation required"
          : "[agent] Usage metering failed",
        error,
        {
          sessionId: ctx.session.id,
          turnId: event.data.turnId,
          billingKey,
          charged,
          trackingStarted,
          automaticRetry: false,
        }
      );
      // Only pre-track failures are safe to release. Keeping the claim after
      // an ambiguous billing failure avoids replaying a possibly accepted charge.
      if (claimed && !trackingStarted) {
        await redis?.del(billedKey).catch(() => null);
      }
    }
  }

  return defineHook({
    events: {
      async "usage.recorded"(event, ctx) {
        let turnId: string | undefined;
        try {
          const billed = billableModelRun(event, ctx);
          if (!billed) {
            return;
          }
          turnId = billed.turnId;
          const { runId } = billed;
          if (allowUnmeteredAiInDevelopment || !shouldChargeAiCredits(ctx)) {
            return;
          }
          const organizationId = getOrganizationId(ctx);
          if (!organizationId) {
            return;
          }
          // eve reports the AI SDK counts, where the prompt total still
          // contains the cached tokens.
          const billable = toAgentTokenUsage(event.data.usage);
          // Eve's costUsd is the Gateway charge, not a verified total including
          // separately billed BYOK inference. Keep per-run token pricing.
          const costUsd = calculateTokenCostUsd(
            billable,
            resolveModelId(turnId)
          );
          const costMicroUsd = Math.round(costUsd * MICRO_USD_PER_USD);
          const runUsage: AccumulatedUsage = {
            inputTokens: billable.inputTokens,
            outputTokens: billable.outputTokens,
            cacheReadTokens: billable.cacheReadTokens,
            cacheWriteTokens: billable.cacheWriteTokens,
            costMicroUsd,
          };

          if (!redis) {
            await trackUsage(resolveModelId(turnId), organizationId, runUsage, {
              ...usageProperties(ctx, turnId),
              run_id: runId,
            });
            return;
          }

          const runKey = `agent:usage:step:${ctx.session.id}:${turnId}:${runId}`;
          const key = accumulatorKey(ctx.session.id, turnId);
          const accumulated = await redis.eval<number[], number>(
            ACCUMULATE_USAGE_SCRIPT,
            [
              runKey,
              key,
              `${key}:billing`,
              billedKeyFor(ctx.session.id, turnId),
            ],
            [
              runUsage.inputTokens,
              runUsage.outputTokens,
              runUsage.cacheReadTokens,
              runUsage.cacheWriteTokens,
              costMicroUsd,
              USAGE_KEY_TTL_SECONDS,
            ]
          );
          if (accumulated === 2) {
            logError(
              "[agent] Usage billing reconciliation required",
              undefined,
              {
                sessionId: ctx.session.id,
                turnId,
                billingKey: key,
                reason: "usage_during_or_after_settlement",
                automaticRetry: false,
              }
            );
          }
        } catch (error) {
          logError("[agent] Usage accumulation failed", error, {
            sessionId: ctx.session.id,
            turnId,
          });
        }
      },
      "turn.settled": settleTurn,
    },
  });
}
