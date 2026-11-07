import { db } from "@notra/db/drizzle";
import { demoSandboxes, projects } from "@notra/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { TRAFFIC_ORG_SITE_PREFIX } from "@/constants/public-data";

/**
 * Sites whose traffic counts towards cross-customer numbers. A project counts
 * when it still exists, isn't a sample project (those ingest generated
 * crawler visits) and doesn't belong to a demo sandbox. Traffic sent without
 * a project arrives as `org:<id>` and counts unless the organization is a
 * demo sandbox.
 */
export async function realTrafficProjectIds(
  ids: string[]
): Promise<Set<string>> {
  const projectIds = ids.filter(
    (id) => id !== "" && !id.startsWith(TRAFFIC_ORG_SITE_PREFIX)
  );
  const orgSites = ids.filter((id) => id.startsWith(TRAFFIC_ORG_SITE_PREFIX));
  const organizationOf = (site: string) =>
    site.slice(TRAFFIC_ORG_SITE_PREFIX.length);
  const demoOrganizations = db
    .select({ organizationId: demoSandboxes.organizationId })
    .from(demoSandboxes);
  const [projectRows, demoRows] = await Promise.all([
    projectIds.length > 0
      ? db
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              inArray(projects.id, projectIds),
              eq(projects.isSample, false),
              notInArray(projects.organizationId, demoOrganizations)
            )
          )
      : [],
    orgSites.length > 0
      ? db
          .select({ organizationId: demoSandboxes.organizationId })
          .from(demoSandboxes)
          .where(
            inArray(demoSandboxes.organizationId, orgSites.map(organizationOf))
          )
      : [],
  ]);
  const demo = new Set(demoRows.map((row) => row.organizationId));
  return new Set([
    ...projectRows.map((row) => row.id),
    ...orgSites.filter((site) => !demo.has(organizationOf(site))),
  ]);
}
