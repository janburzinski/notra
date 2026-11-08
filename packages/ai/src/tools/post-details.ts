import { POST_DETAILS_TAG_SUGGESTIONS } from "@notra/ai/constants/post-metadata";
import { supportsPostSlug } from "@notra/ai/schemas/post";
import { updatePostDetailsInputSchema } from "@notra/ai/schemas/post-metadata";
import type { PostDetailsToolsContext } from "@notra/ai/types/tools";
import {
  listOrganizationTags,
  matchExistingTags,
} from "@notra/ai/utils/post-service";
import { db } from "@notra/db/drizzle";
import { contentAuthors, posts } from "@notra/db/schema";
import { setPostHistoryContext } from "@notra/db/utils/post-history";
import { postMetadataUpdateData } from "@notra/db/utils/post-metadata";
import { type Tool, tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import z from "zod";

async function readPostDetails(context: PostDetailsToolsContext) {
  const [post, authors, tagRows, site] = await Promise.all([
    db.query.posts.findFirst({
      where: and(
        eq(posts.id, context.postId),
        eq(posts.organizationId, context.organizationId)
      ),
      columns: {
        contentType: true,
        coverImage: true,
        tags: true,
        excerpt: true,
        authorIds: true,
        featured: true,
        noindex: true,
        displayDate: true,
      },
    }),
    db
      .select({
        id: contentAuthors.id,
        slug: contentAuthors.slug,
        name: contentAuthors.name,
        title: contentAuthors.title,
      })
      .from(contentAuthors)
      .where(eq(contentAuthors.organizationId, context.organizationId))
      .orderBy(asc(contentAuthors.name)),
    listOrganizationTags(context.organizationId, POST_DETAILS_TAG_SUGGESTIONS),
    context.resolveSiteAuthors?.({
      organizationId: context.organizationId,
      postId: context.postId,
    }) ?? null,
  ]);
  if (!(post && supportsPostSlug(post.contentType))) {
    throw new Error(
      "Post details (cover, tags, authors) only exist for blog posts and changelogs."
    );
  }
  const byId = new Map(authors.map((author) => [author.id, author]));
  const siteBySlug = new Map(
    (site?.authors ?? []).map((author) => [author.slug, author])
  );
  return {
    post,
    authors,
    site,
    details: {
      contentType: post.contentType,
      coverImage: post.coverImage,
      tags: post.tags,
      excerpt: post.excerpt,
      authors: post.authorIds.flatMap((value) => {
        const siteSlug = site?.slugOf(value);
        if (siteSlug) {
          return [
            {
              slug: siteSlug,
              name: siteBySlug.get(siteSlug)?.name ?? siteSlug,
            },
          ];
        }
        const author = byId.get(value);
        return author
          ? [
              {
                slug: author.slug,
                name: siteBySlug.get(author.slug)?.name ?? author.name,
              },
            ]
          : [];
      }),
      featured: post.featured,
      noindex: post.noindex,
      displayDate: post.displayDate?.toISOString().slice(0, 10) ?? null,
      // A post on a Notra site credits the site's authors from its blog.json.
      availableAuthors: (site?.authors ?? authors).map(
        ({ slug, name, title }) => ({ slug, name, title })
      ),
      existingTags: tagRows,
    },
  };
}

/**
 * Lets the content chat read and change the site details shown in the
 * post's Overview tab. The post is fixed by the page, never by the model.
 */
export function createPostDetailsTools(context: PostDetailsToolsContext): {
  getPostDetails: Tool;
  updatePostDetails: Tool;
} {
  const getPostDetails = tool({
    description:
      "Reads the post's site details from the Overview tab: cover image, tags, excerpt, credited authors, featured, search visibility (noindex) and display date, plus the organization's authors and most used tags to choose from.",
    inputSchema: z.object({}),
    execute: async () => (await readPostDetails(context)).details,
  });

  const updatePostDetails = tool({
    description:
      "Changes the post's site details shown in the Overview tab. Send only the fields to change. Use for tags, excerpt/summary, cover image, authors, featured, hiding from search, or the shown date. Never use editMarkdown for these.",
    inputSchema: updatePostDetailsInputSchema,
    execute: async (input) => {
      const { post, authors, site } = await readPostDetails(context);
      let authorIds: string[] | undefined;
      if (input.authors) {
        // A Sites post may still credit Notra authors missing from blog.json;
        // keep those selectable, with site authors winning on a shared slug.
        const credited = new Set(post.authorIds);
        const bySlug = new Map(
          site
            ? [
                ...authors
                  .filter((author) => credited.has(author.id))
                  .map((author) => [author.slug, author.id] as const),
                ...site.authors.map(
                  (author) => [author.slug, site.ref(author.slug)] as const
                ),
              ]
            : authors.map((author) => [author.slug, author.id] as const)
        );
        const unknown = input.authors.filter((slug) => !bySlug.has(slug));
        if (unknown.length > 0) {
          throw new Error(
            `Unknown author slug: ${unknown.join(", ")}. Available: ${[...bySlug.keys()].join(", ") || "none, there are no authors yet"}.`
          );
        }
        authorIds = input.authors.map((slug) => bySlug.get(slug) ?? slug);
      }
      const isBlog = post.contentType === "blog_post";
      const tags = input.tags
        ? await matchExistingTags(context.organizationId, input.tags)
        : undefined;
      await db.transaction(async (tx) => {
        await setPostHistoryContext(tx, { actorUserId: null, source: "ai" });
        await tx
          .update(posts)
          .set({
            ...postMetadataUpdateData({
              coverImage: input.coverImage,
              tags,
              excerpt: input.excerpt,
              authorIds: isBlog ? authorIds : undefined,
              featured: isBlog ? input.featured : undefined,
              noindex: isBlog ? input.noindex : undefined,
              displayDate: input.displayDate,
            }),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(posts.id, context.postId),
              eq(posts.organizationId, context.organizationId)
            )
          );
      });
      return (await readPostDetails(context)).details;
    },
  });

  return { getPostDetails, updatePostDetails };
}
