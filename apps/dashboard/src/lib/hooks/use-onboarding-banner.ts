"use client";

import { useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  useOnboardingAgentBannerDismissal,
  useOnboardingAgentRun,
  useRunOnboardingAgent,
} from "@/lib/hooks/use-onboarding";
import type { UseOnboardingBannerOptions } from "@/types/hooks/onboarding";

/**
 * The banner offering the onboarding agent: whether it shows, starting the
 * agent, and dismissing it, which animates the banner out first.
 */
export function useOnboardingBanner({
  organizationId,
  initialRun,
  initiallyDismissed,
}: UseOnboardingBannerOptions) {
  const t = useTranslations("dashboard.onboardingBanner");
  const { data } = useOnboardingAgentRun(organizationId, initialRun);
  const runAgent = useRunOnboardingAgent();
  const { dismiss, dismissed } = useOnboardingAgentBannerDismissal(
    organizationId,
    initiallyDismissed
  );
  const shouldReduceMotion = useReducedMotion();
  const running = data?.running ?? false;
  const canStart = !!data && !data.ran && !running && !dismissed;
  const available = running || canStart;
  const [dismissingOrganizationId, setDismissingOrganizationId] = useState<
    string | null
  >(null);
  // Switching workspaces ends a dismissal still animating out.
  const [shownOrganizationId, setShownOrganizationId] =
    useState(organizationId);
  if (shownOrganizationId !== organizationId) {
    setShownOrganizationId(organizationId);
    setDismissingOrganizationId(null);
  }
  const dismissing = dismissingOrganizationId === organizationId;
  const starting =
    runAgent.isPending && runAgent.variables?.organizationId === organizationId;

  return {
    available,
    dismissing,
    running,
    starting,
    visible: available && !dismissing,
    start: () => {
      if (!organizationId || starting) {
        return;
      }
      runAgent.mutate(
        { organizationId },
        {
          onError: (error) => toast.error(error.message || t("startFailed")),
        }
      );
    },
    dismiss: () => {
      if (!shouldReduceMotion) {
        setDismissingOrganizationId(organizationId);
      }
      dismiss();
    },
    finishDismissing: () => {
      if (dismissing) {
        setDismissingOrganizationId(null);
      }
    },
  };
}
