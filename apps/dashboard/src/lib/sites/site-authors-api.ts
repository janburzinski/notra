import { db } from "@notra/db/drizzle";
import { contentAuthors, sites } from "@notra/db/schema";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";
import { siteAuthorRef } from "@notra/sites-core/utils/site-author-refs";
import { getSite } from "@notra/sites-server/deployments";
import { publishSiteDrafts } from "@notra/sites-server/editor";
import { listPendingSiteDraftSummaries } from "@notra/sites-server/image-drafts";
import type { Site } from "@notra/sites-server/types/sites";
import { primaryMountUrl } from "@notra/sites-server/utils/urls";
import { and, asc, eq, inArray } from "drizzle-orm";

import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import { SITE_AUTHOR_ERROR_MESSAGES } from "@/constants/site-authors";
import { SiteDesignUnchangedError } from "@/lib/errors/site-authors";
import { badRequest, conflict, notFound } from "@/lib/orpc/utils/errors";
import { deployPublishedCommit } from "@/lib/sites/deploy-published-commit";
import {
  countSiteAuthorUsage,
  resolvePostAuthorSites,
} from "@/lib/sites/post-authors";
import {
  readSiteAuthorsDocument,
  saveSiteAuthorsDocument,
} from "@/lib/sites/site-author-document";
import type {
  SiteAuthorApiRequest,
  SiteAuthorEntry,
  SiteAuthorsDocument,
} from "@/types/site-authors";
import {
  readSiteAuthors,
  removeSiteAuthor,
  setSiteAuthorPageLayout,
  siteAuthorForm,
  siteAuthorFromForm,
  siteAuthorImports,
  siteAuthorPageLayout,
  validateSiteAuthorForm,
  writeSiteAuthor,
} from "@/utils/site-authors";
import { siteAssetUrl } from "@/utils/site-design";
import { configValue, patchConfigValue } from "@/utils/site-design-sections";

type Request<A extends SiteAuthorApiRequest["action"]> = Extract<
  SiteAuthorApiRequest,
  { action: A }
>;

async function requireOwnSite(organizationId: string, siteId: string) {
  const site = await getSite(siteId);
  if (!site || site.organizationId !== organizationId) {
    throw notFound("Site not found");
  }
  return site;
}

async function requireSite(organizationId: string, siteId: string) {
  const site = await requireOwnSite(organizationId, siteId);
  if (!site.mounts.blog) {
    throw conflict("This site has no blog, so it has no authors", {
      code: "SITE_HAS_NO_BLOG",
    });
  }
  return site;
}

function serializeAuthors(
  site: Site,
  document: SiteAuthorsDocument,
  usage: Record<string, number> | null
) {
  const liveUrl = primaryMountUrl(site.publicOrigin, site.mounts);
  const published = new Set(
    readSiteAuthors(document.published).map((entry) => entry.id)
  );
  return readSiteAuthors(document.config).map(({ id, author }) => ({
    id,
    ref: siteAuthorRef(id),
    name: author.name,
    title: author.title ?? null,
    bio: author.bio ?? null,
    avatar: author.avatar ?? null,
    avatarUrl: author.avatar ? siteAssetUrl(liveUrl, author.avatar) : null,
    ...Object.fromEntries(
      CONTENT_AUTHOR_LINK_FIELDS.map((field) => [field, author[field] ?? null])
    ),
    live: published.has(id),
    posts: usage?.[id] ?? 0,
  }));
}

async function siteAuthorsResponse(site: Site) {
  const [document, usage] = await Promise.all([
    readSiteAuthorsDocument(site),
    countSiteAuthorUsage(site),
  ]);
  return {
    site: { id: site.id, name: site.name },
    authors: serializeAuthors(site, document, usage),
    authorPage: siteAuthorPageLayout(document.config),
    hasUnpublishedChanges: Boolean(document.draft),
  };
}

/** Renaming or deleting an author that is live or on posts needs `force`, like the dashboard's confirmation. */
async function assertAuthorUnused(
  site: Site,
  document: SiteAuthorsDocument,
  id: string,
  action: "rename" | "delete"
) {
  const usage = (await countSiteAuthorUsage(site))[id] ?? 0;
  const live = readSiteAuthors(document.published).some(
    (entry) => entry.id === id
  );
  if (!live && usage === 0) {
    return;
  }
  const where = [
    usage > 0
      ? `${usage} Notra ${usage === 1 ? "post credits" : "posts credit"} it`
      : "",
    live ? "its author page is live" : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const effect =
    action === "rename"
      ? "Renaming moves the author page, and posts that name"
      : "After deleting, posts that name";
  throw conflict(
    `"${id}" is in use: ${where}. ${effect} "${id}" show it as a plain name until they name another author. Send force: true to ${action} it anyway.`,
    { code: "SITE_AUTHOR_IN_USE", posts: usage, live }
  );
}

async function putAuthor(input: Request<"putAuthor">) {
  const site = await requireSite(input.organizationId, input.siteId);
  const document = await readSiteAuthorsDocument(site);
  const ids = new Set(
    readSiteAuthors(document.config).map((entry) => entry.id)
  );
  const { previousId: requestedPreviousId, force, ...fields } = input.author;
  const previousId =
    requestedPreviousId && requestedPreviousId !== input.authorId
      ? requestedPreviousId
      : null;
  if (previousId) {
    if (!ids.has(previousId)) {
      throw notFound(`blog.json has no author "${previousId}"`);
    }
    if (ids.has(input.authorId)) {
      throw conflict(`Another author already uses "${input.authorId}"`, {
        code: "SITE_AUTHOR_ID_TAKEN",
      });
    }
    if (!force) {
      await assertAuthorUnused(site, document, previousId, "rename");
    }
  }
  const form = siteAuthorForm({ id: input.authorId, author: { name: "" } });
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    form[field] = fields[field] ?? "";
  }
  const taken = new Set(
    [...ids].filter((id) => id !== (previousId ?? input.authorId))
  );
  const errors = Object.entries(validateSiteAuthorForm(form, taken));
  const [field, error] = errors[0] ?? [];
  if (field && error) {
    throw badRequest(`${field}: ${SITE_AUTHOR_ERROR_MESSAGES[error]}`);
  }
  await saveSiteAuthorsDocument(
    site,
    document,
    writeSiteAuthor(document.config, previousId, siteAuthorFromForm(form)),
    input.actorUserId
  );
  return await siteAuthorsResponse(site);
}

async function deleteAuthor(input: Request<"deleteAuthor">) {
  const site = await requireSite(input.organizationId, input.siteId);
  const document = await readSiteAuthorsDocument(site);
  if (
    !readSiteAuthors(document.config).some(
      (entry) => entry.id === input.authorId
    )
  ) {
    throw notFound(`blog.json has no author "${input.authorId}"`);
  }
  if (!input.force) {
    await assertAuthorUnused(site, document, input.authorId, "delete");
  }
  await saveSiteAuthorsDocument(
    site,
    document,
    removeSiteAuthor(document.config, input.authorId),
    input.actorUserId
  );
  return await siteAuthorsResponse(site);
}

async function setAuthorPage(input: Request<"setAuthorPage">) {
  const site = await requireSite(input.organizationId, input.siteId);
  const document = await readSiteAuthorsDocument(site);
  await saveSiteAuthorsDocument(
    site,
    document,
    setSiteAuthorPageLayout(document.config, document.published, input.layout),
    input.actorUserId
  );
  return await siteAuthorsResponse(site);
}

async function siteSectionsResponse(site: Site) {
  const document = await readSiteAuthorsDocument(site);
  const staged = configValue(document.config, "sections");
  return {
    site: { id: site.id, name: site.name },
    sections:
      typeof staged === "object" && staged !== null ? staged : site.mounts,
    liveSections: site.mounts,
    hasUnpublishedChanges: Boolean(document.draft),
  };
}

/** Writes blog.json `sections`, which the site adopts when a production build of them goes live. */
async function setSections(input: Request<"setSections">) {
  const site = await requireOwnSite(input.organizationId, input.siteId);
  const document = await readSiteAuthorsDocument(site);
  await saveSiteAuthorsDocument(
    site,
    document,
    patchConfigValue(
      document.config,
      "sections",
      normalizeSiteMounts(input.sections)
    ),
    input.actorUserId
  );
  return await siteSectionsResponse(site);
}

async function importAuthors(input: Request<"importAuthors">) {
  const site = await requireSite(input.organizationId, input.siteId);
  const document = await readSiteAuthorsDocument(site);
  const ids = new Set(
    readSiteAuthors(document.config).map((entry) => entry.id)
  );
  const rows: ContentAuthor[] = await db
    .select({
      id: contentAuthors.id,
      slug: contentAuthors.slug,
      name: contentAuthors.name,
      title: contentAuthors.title,
      bio: contentAuthors.bio,
      avatarUrl: contentAuthors.avatarUrl,
      url: contentAuthors.url,
      x: contentAuthors.x,
      linkedin: contentAuthors.linkedin,
      github: contentAuthors.github,
      bluesky: contentAuthors.bluesky,
      mastodon: contentAuthors.mastodon,
      youtube: contentAuthors.youtube,
      threads: contentAuthors.threads,
      instagram: contentAuthors.instagram,
      userId: contentAuthors.userId,
    })
    .from(contentAuthors)
    .where(
      and(
        eq(contentAuthors.organizationId, input.organizationId),
        input.authorIds
          ? inArray(contentAuthors.id, input.authorIds)
          : undefined
      )
    )
    .orderBy(asc(contentAuthors.name), asc(contentAuthors.id));
  if (input.authorIds) {
    const found = new Set(rows.map((row) => row.id));
    const missing = input.authorIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw badRequest(
        `Unknown Notra author: ${missing.join(", ")}. List them with GET /v1/posts/authors.`
      );
    }
  }
  const candidates = input.authorIds
    ? rows
    : rows.filter((row) => !ids.has(row.slug));
  const imports = siteAuthorImports(candidates, ids).filter(
    (item) => input.replace || !item.exists
  );
  const entries: SiteAuthorEntry[] = imports.map(({ id, author }) => ({
    id,
    author,
  }));
  await saveSiteAuthorsDocument(
    site,
    document,
    entries.reduce(
      (config, entry) => writeSiteAuthor(config, null, entry),
      document.config
    ),
    input.actorUserId
  );
  return {
    ...(await siteAuthorsResponse(site)),
    imported: [...new Set(entries.map((entry) => entry.id))],
    avatarsSkipped: imports
      .filter((item) => item.avatarUpload)
      .map((item) => item.id),
  };
}

function otherChangesConflict(paths: readonly string[]) {
  return conflict(
    `Other unpublished changes are staged on this site (${paths.join(", ")}). Publish or discard them in the dashboard.`,
    { code: "SITE_HAS_OTHER_CHANGES", paths }
  );
}

/** Drafts a Design publish may commit: blog.json and the images it uses. */
function assertDesignOnly(paths: readonly string[]) {
  const others = paths.filter(
    (path) => path !== SITE_CONFIG_FILENAME && !isSiteImageDraftPath(path)
  );
  if (others.length > 0) {
    throw otherChangesConflict(others);
  }
  if (!paths.includes(SITE_CONFIG_FILENAME)) {
    throw new SiteDesignUnchangedError();
  }
}

/**
 * Publishes the staged blog.json the way the Design tab's Publish does. Other
 * staged files are someone's unfinished work in the dashboard, so they refuse
 * the publish instead of shipping along. The publisher checks the exact
 * drafts it commits under the branch lock, so a file saved after the quick
 * check here still refuses it.
 */
async function publish(input: Request<"publish">) {
  // Design changes publish on changelog-only sites too.
  const site = await requireOwnSite(input.organizationId, input.siteId);
  const unchanged = {
    published: false,
    commitSha: null,
    deploymentQueued: false,
  };
  try {
    assertDesignOnly(
      (await listPendingSiteDraftSummaries(site)).map((draft) => draft.path)
    );
    const { commitSha } = await publishSiteDrafts(site, {
      message: input.message,
      userId: input.actorUserId,
      assertPublishable: assertDesignOnly,
    });
    const deployPending = await deployPublishedCommit(
      site,
      commitSha,
      input.actorUserId
    );
    return { published: true, commitSha, deploymentQueued: !deployPending };
  } catch (error) {
    if (error instanceof SiteDesignUnchangedError) {
      return unchanged;
    }
    throw error;
  }
}

async function listSites(input: Request<"listSites">) {
  const rows = await db
    .select()
    .from(sites)
    .where(eq(sites.organizationId, input.organizationId))
    .orderBy(asc(sites.createdAt), asc(sites.id));
  return {
    sites: rows.map((site) => ({
      id: site.id,
      name: site.name,
      url: primaryMountUrl(site.publicOrigin, site.mounts),
      status: site.status,
      live: site.activeProductionDeploymentId !== null,
      blogMount: site.mounts.blog ?? null,
    })),
  };
}

/** Each post's site and that site's authors, so the API can show and check `site:` author refs. */
async function postAuthors(input: Request<"postAuthors">) {
  const sitesByPost = await resolvePostAuthorSites(
    input.organizationId,
    input.postIds
  );
  const siteIds = [...new Set([...sitesByPost.values()].map(({ id }) => id))];
  const authorSites = await Promise.all(
    siteIds.map(async (siteId) => {
      const site = await getSite(siteId);
      if (!site) {
        return null;
      }
      return {
        id: site.id,
        name: site.name,
        authors: serializeAuthors(
          site,
          await readSiteAuthorsDocument(site),
          null
        ),
      };
    })
  );
  return {
    posts: [...sitesByPost].map(([postId, site]) => ({
      postId,
      siteId: site.id,
    })),
    sites: authorSites.filter((site) => site !== null),
  };
}

export async function handleSiteAuthorApiRequest(input: SiteAuthorApiRequest) {
  switch (input.action) {
    case "listSites":
      return await listSites(input);
    case "listAuthors":
      return await siteAuthorsResponse(
        await requireSite(input.organizationId, input.siteId)
      );
    case "putAuthor":
      return await putAuthor(input);
    case "deleteAuthor":
      return await deleteAuthor(input);
    case "setAuthorPage":
      return await setAuthorPage(input);
    case "setSections":
      return await setSections(input);
    case "importAuthors":
      return await importAuthors(input);
    case "publish":
      return await publish(input);
    case "postAuthors":
      return await postAuthors(input);
    default:
      throw badRequest("Unknown action");
  }
}
