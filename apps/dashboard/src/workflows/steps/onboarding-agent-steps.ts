import { logError } from "@notra/ai/utils/server-log";

import "@/workflows/runtime";
import {
  getOnboardingAgentState,
  releaseOnboardingAgentReservation,
  startOnboardingAgentSession,
} from "@/lib/onboarding-agent";

export async function startOnboardingAgentSessionStep(input: {
  domain: string;
  organizationId: string;
  reservedAt: string;
}): Promise<{ sessionId: string }> {
  "use step";
  return await startOnboardingAgentSession(input);
}

export async function getOnboardingAgentStateStep(input: {
  organizationId: string;
  poll: number;
  softLimitPolls: number;
}): Promise<{ ran: boolean; organizationDeleted: boolean }> {
  "use step";
  const state = await getOnboardingAgentState(input.organizationId);
  if (!state) {
    return { ran: false, organizationDeleted: true };
  }
  if (!state.ran && input.poll === input.softLimitPolls) {
    logError("[Onboarding Agent] Run exceeded the soft time limit", undefined, {
      organizationId: input.organizationId,
    });
  }
  return { ran: state.ran, organizationDeleted: false };
}

export async function releaseOnboardingAgentReservationStep(input: {
  organizationId: string;
  reservedAt: string;
}): Promise<void> {
  "use step";
  await releaseOnboardingAgentReservation(
    input.organizationId,
    new Date(input.reservedAt)
  );
}

Object.assign(startOnboardingAgentSessionStep, { maxRetries: 0 });
