import { db } from "@notra/db/drizzle";
import { demoSandboxes, projects } from "@notra/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";

/**
 * Projects whose traffic counts towards cross-customer numbers: they still
 * exist, aren't sample projects (those ingest generated crawler visits) and
 * don't belong to a demo sandbox.
 */
export async function realTrafficProjectIds(
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        inArray(projects.id, ids),
        eq(projects.isSample, false),
        notInArray(
          projects.organizationId,
          db
            .select({ organizationId: demoSandboxes.organizationId })
            .from(demoSandboxes)
        )
      )
    );
  return new Set(rows.map((row) => row.id));
}
