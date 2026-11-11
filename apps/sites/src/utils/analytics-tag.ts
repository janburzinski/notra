import {
  SITE_ANALYTICS_EVENT_FILE,
  SITE_ANALYTICS_SCRIPT_FILE,
} from "@notra/sites-core/constants/sites";
import {
  joinMountPath,
  resolveAreaForPath,
} from "@notra/sites-core/utils/mounts";
import { normalizeRequestPath } from "@notra/sites-core/utils/request-paths";

import type {
  AnalyticsScriptTag,
  LoadedManifest,
  ResolvedDeployment,
} from "../types/serving";

/**
 * The mounted area a page belongs to. Pages outside every area (their themed
 * 404) get no script: ingest only counts pages below the site's mounts.
 */
function analyticsMount(
  loaded: LoadedManifest,
  pathname: string
): string | null {
  const path = normalizeRequestPath(pathname);
  if (path === null) {
    return null;
  }
  return resolveAreaForPath(loaded.manifest.target.mounts, path)?.mount ?? null;
}

export function analyticsScriptTag(
  resolved: ResolvedDeployment,
  loaded: LoadedManifest,
  pathname: string,
  visitorConsent: boolean | undefined
): AnalyticsScriptTag | null {
  const mount = resolved.trafficToken ? analyticsMount(loaded, pathname) : null;
  return mount === null
    ? null
    : {
        scriptSrc: joinMountPath(mount, SITE_ANALYTICS_SCRIPT_FILE),
        eventPath: joinMountPath(mount, SITE_ANALYTICS_EVENT_FILE),
        consent: visitorConsent !== undefined,
      };
}
