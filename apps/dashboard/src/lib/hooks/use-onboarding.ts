"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { COMPANY_LOGO_STALE_TIME_MS } from "@/constants/company-logo";
import type {
  OnboardingStatus,
  UseOnboardingStatusOptions,
} from "@/types/hooks/onboarding";

import { dashboardOrpc } from "../orpc/query";

export function useOnboardingStatus(
  organizationId: string,
  options?: UseOnboardingStatusOptions
) {
  return useQuery<OnboardingStatus>(
    dashboardOrpc.onboarding.get.queryOptions({
      input: { organizationId },
      enabled: !!organizationId,
      refetchInterval: (query) => {
        const status = query.state.data;
        if (status?.onboardingCompleted || status?.onboardingDismissed) {
          return false;
        }
        return options?.refetchInterval ?? false;
      },
    })
  );
}

function companyLogoQueryOptions(domain: string | null, name?: string | null) {
  const query = domain ?? name?.trim() ?? "";
  return dashboardOrpc.onboarding.companyLogo.queryOptions({
    input: { query, searchByName: !domain },
    enabled: !domain && query.length > 0,
    staleTime: COMPANY_LOGO_STALE_TIME_MS,
    retry: false,
  });
}

export function useCompanyLogo(domain: string | null, name?: string | null) {
  return useQuery(companyLogoQueryOptions(domain, name));
}

/** Name lookups for many brands; shares the cache with `useCompanyLogo`. */
export function useCompanyLogosByName(names: readonly string[]) {
  return useQueries({
    queries: names.map((name) => companyLogoQueryOptions(null, name)),
  });
}
