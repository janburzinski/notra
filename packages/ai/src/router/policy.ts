import { GATEWAY_FALLBACK_ORDER } from "@notra/ai/constants/router";
import type {
  DecideGatewayInput,
  GatewayDecision,
  GatewayId,
} from "@notra/ai/types/router";

/**
 * Pure routing decision. No I/O, no adapter knowledge — the resolver applies
 * availability and compliance checks on top of this.
 */
export function decideGateway(input: DecideGatewayInput): GatewayDecision {
  const { policy, organizationId, plan, pinned, allowed } = input;

  if (pinned) {
    return { gateway: pinned, reason: "pinned" };
  }

  const decision = decideByPlan(policy, organizationId, plan);
  if (!allowed || allowed.includes(decision.gateway)) {
    return decision;
  }
  const [first] = GATEWAY_FALLBACK_ORDER.filter((id) => allowed.includes(id));
  if (!first) {
    throw new Error("No gateways allowed for this request");
  }
  return { gateway: first, reason: decision.reason };
}

function decideByPlan(
  policy: DecideGatewayInput["policy"],
  organizationId: string | undefined,
  plan: DecideGatewayInput["plan"]
): GatewayDecision {
  if (!organizationId) {
    return { gateway: policy.defaultGateway, reason: "no-org-default" };
  }

  if (plan === "paid") {
    return { gateway: policy.paidGateway, reason: "paid" };
  }

  return { gateway: policy.freeGateway, reason: "free" };
}

export function fallbackGateways(
  gateway: GatewayId,
  allowed?: readonly GatewayId[]
): GatewayId[] {
  return GATEWAY_FALLBACK_ORDER.filter(
    (candidate) =>
      candidate !== gateway && (!allowed || allowed.includes(candidate))
  );
}
