import type { PostSiteAuthors } from "@notra/ai/types/tools";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { contentAuthors, posts, sites } from "@notra/db/schema";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import {
  siteAuthorRef,
  siteAuthorRefId,
} from "@notra/sites-core/utils/site-author-refs";
import { getSite } from "@notra/sites-server/deployments";
import { isSitesConfigured } from "@notra/sites-server/env";
import type { Site } from "@notra/sites-server/types/sites";
import { primaryMountUrl } from "@notra/sites-server/utils/urls";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { readSiteAuthorsDocument } from "@/lib/sites/site-author-document";
import type { PostAuthorSite } from "@/types/site-authors";
import { readSiteAuthors } from "@/utils/site-authors";

async function listBlogSites(organizationId: string) {
  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      projectId: sites.projectId,
      publicOrigin: sites.publicOrigin,
      mounts: sites.mounts,
      repositoryId: sites.repositoryId,
      repositoryOwner: sites.repositoryOwner,
      repositoryName: sites.repositoryName,
    })
    .from(sites)
    .where(
      and(eq(sites.organizationId, organizationId), eq(sites.status, "active"))
    )
    .orderBy(asc(sites.createdAt));
  return rows.filter((site) => Boolean(site.mounts.blog));
}

type BlogSite = Awaited<ReturnType<typeof listBlogSites>>[number];

/**
 * The site whose blog.json authors a post uses. A published post uses the
 * site it went to, matched by site or repository, and none when it went to
 * a repository without a site. An unpublished one uses the only blog site in
 * its project, else the organization's only blog site. Null keeps Notra authors.
 */
function pickAuthorSite(
  post: { githubPublish: unknown; projectId: string | null },
  candidates: BlogSite[]
): BlogSite | null {
  const published = postGitHubPublishSchema.safeParse(post.githubPublish);
  if (published.success) {
    const { siteId, repositoryId, owner, repo } = published.data;
    const linked = candidates.find((site) => site.id === siteId);
    if (linked) {
      return linked;
    }
    const inRepository = candidates.filter(
      (site) =>
        site.repositoryId === repositoryId ||
        (site.repositoryOwner?.toLowerCase() === owner.toLowerCase() &&
          site.repositoryName?.toLowerCase() === repo.toLowerCase())
    );
    return inRepository.length === 1 ? (inRepository[0] ?? null) : null;
  }
  const inProject = post.projectId
    ? candidates.filter((site) => site.projectId === post.projectId)
    : [];
  if (inProject.length === 1) {
    return inProject[0] ?? null;
  }
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

/** The site whose blog.json authors each blog post uses, by post id; posts without one are left out. */
export async function resolvePostAuthorSites(
  organizationId: string,
  postIds: string[]
): Promise<Map<string, PostAuthorSite>> {
  const sitesByPost = new Map<string, PostAuthorSite>();
  if (postIds.length === 0) {
    return sitesByPost;
  }
  const [rows, candidates] = await Promise.all([
    db.query.posts.findMany({
      where: and(
        inArray(posts.id, postIds),
        eq(posts.organizationId, organizationId),
        eq(posts.contentType, "blog_post")
      ),
      columns: { id: true, githubPublish: true },
      with: { collection: { columns: { projectId: true } } },
    }),
    listBlogSites(organizationId),
  ]);
  for (const post of rows) {
    const site = pickAuthorSite(
      {
        githubPublish: post.githubPublish,
        projectId: post.collection.projectId,
      },
      candidates
    );
    if (site) {
      sitesByPost.set(post.id, {
        id: site.id,
        name: site.name,
        liveUrl: primaryMountUrl(site.publicOrigin, site.mounts),
      });
    }
  }
  return sitesByPost;
}

export async function resolvePostAuthorSite(
  organizationId: string,
  postId: string
): Promise<PostAuthorSite | null> {
  const sitesByPost = await resolvePostAuthorSites(organizationId, [postId]);
  return sitesByPost.get(postId) ?? null;
}

/**
 * The blog.json authors (unpublished Design changes included) the content
 * chat offers for a post on a Notra site; null keeps it on Notra authors.
 */
export async function resolvePostSiteAuthors(target: {
  organizationId: string;
  postId: string;
}): Promise<PostSiteAuthors | null> {
  if (!isSitesConfigured() || isDemoMode()) {
    return null;
  }
  try {
    const authorSite = await resolvePostAuthorSite(
      target.organizationId,
      target.postId
    );
    const site = authorSite ? await getSite(authorSite.id) : null;
    if (!site) {
      return null;
    }
    const { config } = await readSiteAuthorsDocument(site);
    return {
      authors: readSiteAuthors(config).map(({ id, author }) => ({
        slug: id,
        name: author.name,
        title: author.title ?? null,
      })),
      ref: siteAuthorRef,
      slugOf: siteAuthorRefId,
    };
  } catch (error) {
    logError("Couldn't read the site authors for a post", error, target);
    return null;
  }
}

/**
 * How many Notra posts name each blog.json author: by site author id, or by
 * a Notra author whose slug is that id, which the editor shows as the same
 * author. Each post counts once per author.
 */
export async function countSiteAuthorUsage(
  site: Site
): Promise<Record<string, number>> {
  const [candidates, slugs, rows] = await Promise.all([
    listBlogSites(site.organizationId),
    db
      .select({ id: contentAuthors.id, slug: contentAuthors.slug })
      .from(contentAuthors)
      .where(eq(contentAuthors.organizationId, site.organizationId)),
    db.query.posts.findMany({
      where: and(
        eq(posts.organizationId, site.organizationId),
        eq(posts.contentType, "blog_post"),
        sql`cardinality(${posts.authorIds}) > 0`
      ),
      columns: { authorIds: true, githubPublish: true },
      with: { collection: { columns: { projectId: true } } },
    }),
  ]);
  const slugById = new Map(slugs.map((row) => [row.id, row.slug]));
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const target = pickAuthorSite(
      { githubPublish: row.githubPublish, projectId: row.collection.projectId },
      candidates
    );
    if (target?.id !== site.id) {
      continue;
    }
    const ids = new Set(
      row.authorIds.flatMap((value) => {
        const id = siteAuthorRefId(value) ?? slugById.get(value);
        return id ? [id] : [];
      })
    );
    for (const id of ids) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
