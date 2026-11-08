import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  listSiteSourceFiles,
  readPublishedFile,
  readSiteDraft,
  saveSiteDraft,
} from "@notra/sites-server/editor";
import {
  SiteInputError,
  SitePublishConflictError,
} from "@notra/sites-server/errors/sites";
import type { Site } from "@notra/sites-server/types/sites";
import { defaultSiteConfigContent } from "@notra/sites-server/utils/default-config";
import { siteSourceContext } from "@notra/sites-server/utils/source-context";

import type { SiteAuthorsDocument } from "@/types/site-authors";
import type { SiteRawConfig } from "@/types/site-design";
import { serializeSiteConfig } from "@/utils/site-design";
import {
  designIssues,
  parseDesignSource,
  validDesignSource,
} from "@/utils/site-design-sections";

/** The production blog.json as the Design tab shows it, unpublished changes included. */
export async function readSiteAuthorsDocument(
  site: Site
): Promise<SiteAuthorsDocument> {
  const [file, draft] = await Promise.all([
    readPublishedFile(site, SITE_CONFIG_FILENAME),
    readSiteDraft(site, SITE_CONFIG_FILENAME),
  ]);
  const content =
    draft && !draft.deleted
      ? draft.content
      : (file?.content ?? defaultSiteConfigContent(site));
  return {
    file,
    draft,
    content,
    config: parseDesignSource(content),
    published: parseDesignSource(file?.content ?? ""),
  };
}

/**
 * Saves `next` into the blog.json draft the Design tab edits, under the same
 * rules: a file that doesn't parse or breaks the schema isn't saved, and a
 * draft another editor changed meanwhile is a conflict.
 */
export async function saveSiteAuthorsDocument(
  site: Site,
  document: SiteAuthorsDocument,
  next: SiteRawConfig,
  userId: string | null
): Promise<void> {
  if (!validDesignSource(document.content)) {
    throw new SitePublishConflictError(
      [SITE_CONFIG_FILENAME],
      "blog.json can't be parsed. Fix it in the dashboard first."
    );
  }
  if (JSON.stringify(next) === JSON.stringify(document.config)) {
    return;
  }
  const [issue] = designIssues(next);
  if (issue) {
    const message = `blog.json would be invalid at ${issue.path || "the root"}: ${issue.message}`;
    if (designIssues(document.config).length > 0) {
      throw new SitePublishConflictError(
        [SITE_CONFIG_FILENAME],
        `${message}. Fix blog.json in the dashboard first.`
      );
    }
    throw new SiteInputError(message);
  }
  const baseCommitSha =
    document.draft?.baseCommitSha ??
    (await listSiteSourceFiles(site)).commitSha;
  await saveSiteDraft(site, {
    path: SITE_CONFIG_FILENAME,
    content: serializeSiteConfig(next),
    baseBlobSha: document.draft
      ? document.draft.baseBlobSha
      : (document.file?.sha ?? null),
    baseCommitSha,
    draftId: document.draft?.id ?? null,
    draftRevision: document.draft?.revision ?? null,
    sourceContext: siteSourceContext(site),
    userId,
  });
}
