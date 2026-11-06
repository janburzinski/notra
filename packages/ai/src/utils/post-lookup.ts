import type { PostLookupResult } from "@notra/ai/types/post-lookup";
import { db } from "@notra/db/drizzle";
import { posts } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

const POST_LOOKUP_FIELDS = [posts.id, posts.slug, posts.title] as const;

/**
 * Finds a post by ID, then slug, then exact title, so an identifier never
 * resolves to a different post that happens to share it as a title.
 */
export async function findPostByIdentifier(
  organizationId: string,
  identifier: string
): Promise<PostLookupResult> {
  for (const field of POST_LOOKUP_FIELDS) {
    const matches = await db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(
        and(eq(posts.organizationId, organizationId), eq(field, identifier))
      )
      .limit(2);
    if (matches.length > 1) {
      return { status: "ambiguous" };
    }
    if (matches[0]) {
      return { status: "found", post: matches[0] };
    }
  }
  return { status: "missing" };
}
