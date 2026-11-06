import { parseAsString, parseAsStringLiteral } from "nuqs/server";

import { parseAsOnboardingWebsite } from "@/lib/onboarding/website-param";

import { marketingAttributionUrlKeys } from "./marketing-attribution-keys";

export const marketingAttributionServerSearchParams = {
  dbLandingPageH1Copy: parseAsString,
  dbLandingPageH1Variant: parseAsString,
  dbSource: parseAsString,
  signupMethod: parseAsStringLiteral(["email", "google", "github"]),
  website: parseAsOnboardingWebsite,
};

export const marketingAttributionServerUrlKeys = marketingAttributionUrlKeys;
