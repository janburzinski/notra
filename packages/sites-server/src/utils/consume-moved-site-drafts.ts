import { and, eq } from "drizzle-orm";

import { SiteInputError } from "../errors";
import type { SiteDraft } from "../types/editor";
import type { Site } from "../types/sites";
import { withSiteBranchLock } from "./site-branch-lock";
import { siteDraftTable } from "./site-draft-table";

/** Consume the snapshot atomically, only after committing it on the new branch. */
export async function consumeMovedSiteDrafts(
  site: Site,
  branch: string,
  drafts: readonly SiteDraft[]
) {
  if (drafts.length === 0) {
    return;
  }
  const table = siteDraftTable(branch, site.productionBranch);
  await withSiteBranchLock(site.id, branch, async (tx) => {
    for (const draft of drafts) {
      const removed = await tx
        .delete(table)
        .where(
          and(
            eq(table.siteId, site.id),
            eq(table.branch, branch),
            eq(table.id, draft.id),
            eq(table.revision, draft.revision)
          )
        )
        .returning({ id: table.id });
      if (removed.length !== 1) {
        throw new SiteInputError(
          "Changes were committed to the new branch, but the original branch changed meanwhile. Its pending changes were kept."
        );
      }
    }
  });
}
