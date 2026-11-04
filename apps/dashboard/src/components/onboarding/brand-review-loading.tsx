"use client";

import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import {
  ONBOARDING_DISCOVERY_LOADING_STEP_MS,
  ONBOARDING_DISCOVERY_LOADING_STEPS,
} from "@/constants/onboarding";

export function BrandReviewLoading() {
  const t = useTranslations("onboarding.visibility.loading");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStep((current) =>
        Math.min(current + 1, ONBOARDING_DISCOVERY_LOADING_STEPS.length - 1)
      );
    }, ONBOARDING_DISCOVERY_LOADING_STEP_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-10 text-center"
      role="status"
    >
      <Spinner className="text-primary size-6" />
      <Shimmer as="p" className="text-sm" key={step}>
        {t(
          ONBOARDING_DISCOVERY_LOADING_STEPS[step] ??
            ONBOARDING_DISCOVERY_LOADING_STEPS[0]
        )}
      </Shimmer>
    </div>
  );
}
