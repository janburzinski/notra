import { db } from "@notra/db/drizzle";
import { geoSettings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

function brandKey(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Whether a brand is the workspace's own, by its GEO company name or an
 * alias, so a ranking of brands can keep only competitors.
 */
export async function loadIsOwnBrand(
  organizationId: string,
  projectId: string | undefined
) {
  const rows = await db
    .select({
      companyName: geoSettings.companyName,
      aliases: geoSettings.aliases,
    })
    .from(geoSettings)
    .where(
      and(
        eq(geoSettings.organizationId, organizationId),
        projectId ? eq(geoSettings.projectId, projectId) : undefined
      )
    );
  const own = new Set(
    rows
      .flatMap((row) => [row.companyName, ...row.aliases])
      .map(brandKey)
      .filter(Boolean)
  );
  return (brand: string) => own.has(brandKey(brand));
}
