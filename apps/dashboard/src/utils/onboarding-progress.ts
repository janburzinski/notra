import type { GeoOnboardingStage } from "@notra/geo-core/types/geo";

import {
  ONBOARDING_STEP_AUTOPILOT,
  ONBOARDING_STEP_COMPETITORS,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_PRICING,
  ONBOARDING_STEP_VISIBILITY,
  ONBOARDING_STEP_WORKSPACE,
} from "@/constants/onboarding";
import type {
  OnboardingProgressHrefInput,
  OnboardingProgressHrefs,
} from "@/types/onboarding";
import {
  geoOnboardingAutopilotPath,
  geoOnboardingCompetitorsPath,
  geoOnboardingPath,
  geoOnboardingPricingPath,
  geoOnboardingWorkspacePath,
} from "@/utils/geo-paths";

function isStepReachable(
  step: number,
  hasOrganization: boolean,
  hasBrand: boolean,
  stage: GeoOnboardingStage | null
): boolean {
  if (step === ONBOARDING_STEP_WORKSPACE) {
    return hasOrganization;
  }
  if (step === ONBOARDING_STEP_VISIBILITY) {
    return hasBrand;
  }
  if (step === ONBOARDING_STEP_COMPETITORS) {
    return stage === "competitors" || stage === "complete";
  }
  return stage === "complete";
}

/** Step ids shown in the progress bar, in order. */
export function onboardingSteps(autopilot: boolean): number[] {
  return ONBOARDING_STEP_ORDER.filter(
    (step) => autopilot || step !== ONBOARDING_STEP_AUTOPILOT
  );
}

export function onboardingProgressHrefs({
  current,
  hasOrganization,
  hasBrand,
  stage,
  projectId,
  replay = false,
  autopilot,
}: OnboardingProgressHrefInput): OnboardingProgressHrefs {
  const paths: Record<number, string> = {
    [ONBOARDING_STEP_WORKSPACE]: geoOnboardingWorkspacePath(projectId, replay),
    [ONBOARDING_STEP_VISIBILITY]: geoOnboardingPath(projectId, replay),
    [ONBOARDING_STEP_COMPETITORS]: geoOnboardingCompetitorsPath(
      projectId,
      replay
    ),
    [ONBOARDING_STEP_AUTOPILOT]: geoOnboardingAutopilotPath(projectId, replay),
    [ONBOARDING_STEP_PRICING]: geoOnboardingPricingPath(projectId, replay),
  };

  return onboardingSteps(autopilot).map((step) => ({
    step,
    href:
      step !== current &&
      isStepReachable(step, hasOrganization, hasBrand, stage)
        ? (paths[step] ?? null)
        : null,
  }));
}
