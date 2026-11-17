export interface OnboardingStatus {
  hasPrompt: boolean;
  hasCompetitor: boolean;
  hasScan: boolean;
  hasAgentReadiness: boolean;
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
}

export interface UseOnboardingStatusOptions {
  refetchInterval?: number | false;
}
