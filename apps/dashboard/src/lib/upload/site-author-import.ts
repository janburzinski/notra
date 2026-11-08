import { SITE_IMAGE_UPLOAD_MAX_BYTES } from "@notra/sites-core/constants/uploads";

import type {
  SiteAuthorEntry,
  SiteAuthorImport,
  SiteAuthorImportResult,
  SiteAuthorImportWorkspace,
} from "@/types/site-authors";
import { shrinkSiteImage } from "@/utils/shrink-site-image";

/** Copies a dashboard-only avatar into the site's images; null when it can't. */
async function copyAvatar(
  url: string,
  workspace: SiteAuthorImportWorkspace
): Promise<string | null> {
  const finish = workspace.beginImageUpload();
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const prepared = await shrinkSiteImage(
      new File([blob], url.split("/").at(-1) ?? "avatar", { type: blob.type }),
      "logo"
    );
    return prepared.size > SITE_IMAGE_UPLOAD_MAX_BYTES
      ? null
      : await workspace.uploadImage(prepared, "logo");
  } catch {
    return null;
  } finally {
    finish();
  }
}

/**
 * The blog.json entries for the chosen Notra authors. Each avatar upload is
 * its own image draft, so they run side by side; a failed copy only drops
 * that avatar and is reported by author name.
 */
export async function prepareSiteAuthorImport(
  imports: SiteAuthorImport[],
  workspace: SiteAuthorImportWorkspace
): Promise<SiteAuthorImportResult> {
  const results = await Promise.all(
    imports.map(async (item): Promise<[SiteAuthorEntry, boolean]> => {
      const author = { ...item.author };
      if (!item.avatarUpload) {
        return [{ id: item.id, author }, true];
      }
      const path = await copyAvatar(item.avatarUpload, workspace);
      if (path) {
        author.avatar = path;
      }
      return [{ id: item.id, author }, path !== null];
    })
  );
  return {
    entries: results.map(([entry]) => entry),
    failedAvatars: results
      .filter(([, copied]) => !copied)
      .map(([entry]) => entry.author.name),
  };
}
