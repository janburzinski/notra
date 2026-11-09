import { siteSectionsSchema } from "@notra/sites-core/schemas/site-sections";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";

/**
 * The sections a blog.json sets, normalized. Null when the file has no
 * `sections` or they don't validate: the build reports invalid ones itself.
 */
export function readConfigSections(source: string | null): SiteMounts | null {
  if (source === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("sections" in parsed)
  ) {
    return null;
  }
  const sections = siteSectionsSchema.safeParse(parsed.sections);
  return sections.success ? normalizeSiteMounts(sections.data) : null;
}
