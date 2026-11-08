import { internalPostSiteAuthorsResponseSchema } from "@notra/schemas/api/sites";
import { siteAuthorRefId } from "@notra/sites-core/utils/site-author-refs";
import type { Context } from "hono";

import type { ApiEnv } from "../types/env";
import type {
  PostAuthorSummary,
  PostRow,
  PostSiteAuthorsByPost,
} from "../types/posts";
import { callSites, sitesErrorResponse } from "./sites";

function hasSiteAuthors(post: Pick<PostRow, "contentType" | "authorIds">) {
  return (
    post.contentType === "blog_post" &&
    post.authorIds.some((id) => siteAuthorRefId(id) !== null)
  );
}

async function fetchPostSiteAuthors(
  c: Context<ApiEnv>,
  organizationId: string,
  postIds: string[]
) {
  return await callSites(
    c.env ?? {},
    { action: "postAuthors", organizationId, postIds },
    internalPostSiteAuthorsResponseSchema
  );
}

/**
 * Resolves the `site:<id>` authors of blog posts that publish to a Notra
 * site. Only posts that name one cost a dashboard call; when it fails the
 * posts still render, with those authors as their bare ids.
 */
export async function loadPostSiteAuthors(
  c: Context<ApiEnv>,
  organizationId: string,
  rows: readonly Pick<PostRow, "id" | "contentType" | "authorIds">[]
): Promise<PostSiteAuthorsByPost> {
  const postIds = rows.filter(hasSiteAuthors).map((post) => post.id);
  if (postIds.length === 0) {
    return new Map();
  }
  try {
    const result = await fetchPostSiteAuthors(c, organizationId, postIds);
    const bySite = new Map(
      result.sites.map((site) => [
        site.id,
        new Map(
          site.authors.map((author): [string, PostAuthorSummary] => [
            author.ref,
            {
              id: author.ref,
              slug: author.id,
              name: author.name,
              title: author.title,
              avatarUrl: author.avatarUrl,
              url: author.url,
              x: author.x,
              linkedin: author.linkedin,
              github: author.github,
              youtube: author.youtube,
              bluesky: author.bluesky,
              mastodon: author.mastodon,
              threads: author.threads,
              instagram: author.instagram,
            },
          ])
        ),
      ])
    );
    return new Map(
      result.posts.flatMap(({ postId, siteId }) => {
        const authors = bySite.get(siteId);
        return authors ? [[postId, authors] as const] : [];
      })
    );
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : String(error), {
      errorCode: "post_site_authors_unavailable",
    });
    return null;
  }
}

/**
 * Checks `site:<id>` entries against the blog.json of the site the post
 * publishes to, unpublished Design changes included. Returns the error
 * response to send, or null when every entry is an author there.
 */
export async function verifyPostSiteAuthors(
  c: Context<ApiEnv>,
  organizationId: string,
  postId: string,
  siteAuthorIds: readonly string[]
) {
  let result: Awaited<ReturnType<typeof fetchPostSiteAuthors>>;
  try {
    result = await fetchPostSiteAuthors(c, organizationId, [postId]);
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
  const siteId = result.posts.find((post) => post.postId === postId)?.siteId;
  const site = result.sites.find((candidate) => candidate.id === siteId);
  if (!site) {
    return c.json(
      {
        error:
          "This post doesn't publish to a Notra Sites site with a blog, so metadata.authorIds can't name site authors. Use IDs from GET /v1/posts/authors.",
        code: "POST_HAS_NO_SITE",
      },
      400
    );
  }
  const known = new Set(site.authors.map((author) => author.ref));
  const unknown = siteAuthorIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return c.json(
      {
        error: `metadata.authorIds: ${unknown.join(", ")} is not an author of ${site.name}. List its authors with GET /v1/sites/${site.id}/authors.`,
        code: "UNKNOWN_SITE_AUTHOR",
      },
      400
    );
  }
  return null;
}
