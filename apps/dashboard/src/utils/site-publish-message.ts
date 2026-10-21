import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";

import type { SiteEditorDraft } from "@/types/sites";

export function sitePublishMessageKey(
  drafts: readonly Pick<SiteEditorDraft, "path">[]
) {
  if (
    drafts.length > 0 &&
    drafts.every(({ path }) => path === SITE_CONFIG_FILENAME)
  ) {
    return "messageDesign";
  }
  if (drafts.length > 0 && drafts.every(({ path }) => /\.mdx?$/.test(path))) {
    return "messagePosts";
  }
  return "messageSite";
}
