"use client";

import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { Button } from "@notra/ui/components/ui/button";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";

import { AutopilotSetupForm } from "@/components/autopilot/autopilot-setup-form";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { OnboardingStepViewTracker } from "@/components/onboarding/step-view-tracker";
import { ONBOARDING_STEPS } from "@/constants/analytics-events";
import { ONBOARDING_STEP_AUTOPILOT } from "@/constants/onboarding";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotOnboardingStepProps } from "@/types/autopilot";

export function AutopilotOnboardingStep({
  organizationId,
  callbackPath,
  nextHref,
  inOnboardingFlow,
  progressHrefs,
  projectId,
}: AutopilotOnboardingStepProps) {
  const router = useRouter();
  const overviewQuery = useQuery(
    dashboardOrpc.autopilot.get.queryOptions({ input: { organizationId } })
  );

  const finish = async () => {
    await dashboardOrpc.autopilot.runNow
      .call({ organizationId, trigger: "onboarding" })
      .catch(() => undefined);
    router.push(nextHref);
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <OnboardingStepViewTracker
        inOnboardingFlow={inOnboardingFlow}
        step={ONBOARDING_STEPS.AUTOPILOT}
      />
      <div className="flex justify-center">
        <OnboardingProgress
          current={ONBOARDING_STEP_AUTOPILOT}
          hrefs={progressHrefs}
        />
      </div>
      <AuthFormHeader
        description="Connect GitHub and Slack. Every morning Notra fixes your agent readiness, drafts posts for keywords you are missing and turns shipped work into posts. You only press merge."
        title="Let Notra work for you every day"
      />
      {overviewQuery.data ? (
        <AutopilotSetupForm
          callbackPath={callbackPath}
          onSaved={finish}
          organizationId={organizationId}
          overview={overviewQuery.data}
          projectId={projectId}
          submitLabel="Turn on Autopilot"
        />
      ) : (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      <div className="flex justify-center">
        <Button onClick={() => router.push(nextHref)} variant="ghost">
          Skip for now
        </Button>
      </div>
    </div>
  );
}
