import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { cn } from "@/lib/utils";
import type { OnboardingProgressProps } from "@/types/onboarding";
import { onboardingSteps } from "@/utils/onboarding-progress";

// Before a workspace exists its flags are unknown, so show the base flow.
const FALLBACK_STEPS = onboardingSteps(false).map((step) => ({
  step,
  href: null,
}));

function getStepClasses(position: number, current: number) {
  if (position === current) {
    return "w-6 bg-primary";
  }
  if (position < current) {
    return "w-1.5 bg-primary/60";
  }
  return "w-1.5 bg-muted-foreground/30";
}

export function OnboardingProgress({
  current,
  hrefs,
}: OnboardingProgressProps) {
  const t = useTranslations("onboarding.progress");
  const steps = hrefs ?? FALLBACK_STEPS;
  const currentPosition =
    steps.findIndex((entry) => entry.step === current) + 1;
  return (
    <nav
      aria-label={t("label", {
        current: currentPosition,
        total: steps.length,
      })}
      className="flex items-center"
    >
      {steps.map(({ step, href }, index) => {
        const position = index + 1;
        const pill = (
          <span
            aria-current={step === current ? "step" : undefined}
            className={cn(
              "block h-1.5 rounded-full transition-all",
              getStepClasses(position, currentPosition)
            )}
          />
        );

        if (!href) {
          return (
            <span className="flex h-6 items-center px-0.5" key={step}>
              {pill}
            </span>
          );
        }

        return (
          <Link
            aria-label={t("goTo", { step: String(step) })}
            className="focus-visible:ring-ring relative flex h-6 items-center rounded-full px-0.5 after:absolute after:-inset-x-1 after:inset-y-0 hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
            href={href}
            key={step}
          >
            {pill}
          </Link>
        );
      })}
    </nav>
  );
}
