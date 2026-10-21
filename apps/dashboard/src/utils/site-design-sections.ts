import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import type { SiteRawConfig } from "@/types/site-design";
import type {
  SiteDesignIssue,
  SiteDesignSaveStatusInput,
} from "@/types/site-design-sections";
import { parseSiteConfig } from "@/utils/site-design";

export function parseDesignSource(source: string): SiteRawConfig {
  try {
    return parseSiteConfig(source);
  } catch {
    return {};
  }
}
export function validDesignSource(source: string): boolean {
  try {
    parseSiteConfig(source);
    return true;
  } catch {
    return false;
  }
}
export function designIssues(config: SiteRawConfig): SiteDesignIssue[] {
  const result = siteConfigSchema.safeParse(config);
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
}
export function configValue(config: unknown, path: string): unknown {
  let value = config;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    value = (value as SiteRawConfig)[key];
  }
  return value;
}
/** Patch a single field without normalizing or dropping untouched configuration. */
export function patchConfigValue(
  config: SiteRawConfig,
  path: string,
  value: unknown
): SiteRawConfig {
  const next = structuredClone(config);
  if (value === "" && path === "banner.content") {
    delete next.banner;
    return next;
  }
  if (
    value === "" &&
    [
      "integrations.ga4.measurementId",
      "integrations.plausible.domain",
      "integrations.posthog.apiKey",
      "integrations.umami.websiteId",
    ].includes(path)
  ) {
    return patchConfigValue(
      config,
      path.split(".").slice(0, -1).join("."),
      undefined
    );
  }
  const keys = path.split(".");
  let target = next;
  for (const key of keys.slice(0, -1)) {
    const current = target[key];
    target[key] =
      typeof current === "object" && current !== null ? current : {};
    target = target[key] as SiteRawConfig;
  }
  const key = keys.at(-1)!;
  if (value === "" || value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
  // Empty optional groups mean "use defaults" or "disabled".
  for (let depth = keys.length - 1; depth > 0; depth--) {
    const parent = configValue(next, keys.slice(0, depth - 1).join(".")) as
      | SiteRawConfig
      | undefined;
    const holder = depth === 1 ? next : parent;
    const childKey = keys[depth - 1]!;
    const child = holder?.[childKey];
    if (
      child &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      Object.keys(child).length === 0
    ) {
      delete holder![childKey];
    }
  }
  return next;
}
export function configSectionChanged(
  config: SiteRawConfig,
  published: SiteRawConfig,
  paths: readonly string[]
): boolean {
  return paths.some(
    (path) =>
      JSON.stringify(configValue(config, path)) !==
      JSON.stringify(configValue(published, path))
  );
}

export function siteDesignSaveStatus(state: SiteDesignSaveStatusInput) {
  if (state.invalid) {
    return "invalid";
  }
  if (state.saves.state.status === "error") {
    return "saveFailed";
  }
  return state.unsaved ? "saving" : "saved";
}
