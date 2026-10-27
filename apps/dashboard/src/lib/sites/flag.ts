import { isSitesEnabledForOrganization as isSitesEnabledByProvider } from "@notra/ai/utils/sites-access";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";

import {
  SITES_BULK_IMPORT_FLAG_KEY,
  SITES_FLAG_TIMEOUT_MS,
} from "@/constants/sites";
import { resolveGeoFlagState } from "@/lib/geo/flag";
import { isSitesFixtureFlagRequestAllowed } from "@/utils/sites-test-access";

export function isSitesFixtureFlagEnabled(organizationId: string): boolean {
  if (process.env.SITES_TEST_FIXTURE_FLAGS_ENABLED !== "true") {
    return false;
  }
  try {
    return isSitesFixtureFlagRequestAllowed(
      { headers: getRequestHeaders() },
      organizationId
    );
  } catch {
    return false;
  }
}

function isFlagEnabledForOrganization(
  flagKey: string,
  organizationId: string
): Promise<boolean> {
  return Effect.runPromise(
    resolveGeoFlagState(flagKey, organizationId).pipe(
      Effect.timeout(SITES_FLAG_TIMEOUT_MS),
      Effect.map((state) => state === "enabled")
    )
  ).catch(() => false);
}

export function isSitesEnabledForOrganization(
  organizationId: string
): Promise<boolean> {
  if (isSitesFixtureFlagEnabled(organizationId)) {
    return Promise.resolve(true);
  }
  return isSitesEnabledByProvider(organizationId);
}

export function isSitesBulkImportEnabled(
  organizationId: string
): Promise<boolean> {
  return isFlagEnabledForOrganization(
    SITES_BULK_IMPORT_FLAG_KEY,
    organizationId
  );
}
