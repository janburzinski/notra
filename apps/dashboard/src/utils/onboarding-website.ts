import { createSerializer } from "nuqs/server";

import { ONBOARDING_WEBSITE_PARAM } from "@/constants/onboarding";
import { parseAsOnboardingWebsite } from "@/lib/onboarding/website-param";
import type { UiRouteSearch } from "@/types/ui-route";
import { firstSearchParamValue } from "@/utils/settings-path";

const serializeOnboardingWebsite = createSerializer({
  [ONBOARDING_WEBSITE_PARAM]: parseAsOnboardingWebsite,
});

export function withOnboardingWebsite(
  href: string,
  searchParams: UiRouteSearch
): string {
  return serializeOnboardingWebsite(href, {
    [ONBOARDING_WEBSITE_PARAM]: parseAsOnboardingWebsite.parseServerSide(
      firstSearchParamValue(searchParams[ONBOARDING_WEBSITE_PARAM])
    ),
  });
}
