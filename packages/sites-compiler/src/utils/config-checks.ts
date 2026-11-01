import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import { tagSlug } from "@notra/sites-core/utils/tags";

import type { SiteEntry } from "../types/entries";
import { closestName } from "./closest-name";

export function unknownConfigKeyWarnings(raw: unknown): SiteDiagnostic[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const known = Object.keys(siteConfigSchema.shape);
  return Object.keys(raw)
    .filter((key) => !known.includes(key))
    .map((key) => {
      const suggestion = closestName(key, known);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
      return {
        severity: "warning" as const,
        file: SITE_CONFIG_FILENAME,
        code: "config_unknown_key",
        message: `Unknown setting "${key}" is ignored.${hint}`,
      };
    });
}

export function featuredSlugWarnings(
  config: SiteConfig,
  entries: SiteEntry[]
): SiteDiagnostic[] {
  const featured = config.blog?.featured;
  if (!Array.isArray(featured)) {
    return [];
  }
  const slugs = new Set(
    entries.filter((entry) => entry.area === "blog").map((entry) => entry.slug)
  );
  return featured
    .filter((slug) => !slugs.has(slug))
    .map((slug) => ({
      severity: "warning" as const,
      file: SITE_CONFIG_FILENAME,
      code: "featured_unknown",
      message: `blog.featured: no post at blog/${slug}. It is skipped.`,
    }));
}

export function categoryWarnings(
  config: SiteConfig,
  blogTags: ReadonlySet<string>
): SiteDiagnostic[] {
  const categories = config.blog?.categories;
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories
    .filter((name) => !blogTags.has(tagSlug(name)))
    .map((name) => ({
      severity: "warning" as const,
      file: SITE_CONFIG_FILENAME,
      code: "category_unknown",
      message: `blog.categories: no post is tagged "${name}". It is skipped.`,
    }));
}
