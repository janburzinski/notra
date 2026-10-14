import { createContext } from "react";

import type { OnboardingLayoutContext } from "@/types/onboarding-layout";

export const OnboardingSplitLayoutContext =
  createContext<OnboardingLayoutContext | null>(null);
