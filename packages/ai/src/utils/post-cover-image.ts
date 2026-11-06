import {
  GENERATED_COVER_TIMEOUT_MS,
  GENERATED_COVER_URL,
  POST_COVER_ALT_MAX_LENGTH,
} from "@notra/ai/constants/post-metadata";
import { postCoverImageSchema } from "@notra/ai/schemas/post-metadata";
import type { GenerateOgImageParams } from "@notra/ai/types/og-image";
import {
  deleteGeneratedCoverAsset,
  uploadGeneratedCoverAsset,
} from "@notra/ai/utils/image-assets";
import { fallbackOgTemplate } from "@notra/ai/utils/og-fallback";
import { generateBrandOgImage } from "@notra/ai/utils/og-image";
import { renderOgImage } from "@notra/ai/utils/og-render";
import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { organizations, posts } from "@notra/db/schema";
import type { PostCoverImage } from "@notra/db/types/post-metadata";
import { eq, sql } from "drizzle-orm";

/** The brand's OG image, or an organization-name card when it has no brand. */
export async function renderPostOgImage(params: GenerateOgImageParams) {
  try {
    return await generateBrandOgImage(params);
  } catch (error) {
    if (
      params.brandIdentityId ||
      !(error instanceof Error) ||
      error.message !== "Brand identity not found in this organization"
    ) {
      throw error;
    }
    const organization = await db.query.organizations.findFirst({
      columns: { name: true },
      where: eq(organizations.id, params.organizationId),
    });
    if (!organization) {
      throw error;
    }
    const brand = {
      id: "",
      name: organization.name,
      websiteUrl: null,
      guideline: null,
      assets: [],
    };
    const fallback = await fallbackOgTemplate(brand);
    return {
      ...(await renderOgImage(fallback, params.title, brand)),
      brandIdentityId: "",
      templateSource: "fallback" as const,
      warnings: [
        "No brand identity is configured; using an organization-name fallback.",
      ],
    };
  }
}

/** A cover Notra generated, as opposed to one a person or agent chose. */
export function isGeneratedCoverImage(coverImage: unknown) {
  const parsed = postCoverImageSchema.safeParse(coverImage);
  return parsed.success && GENERATED_COVER_URL.test(parsed.data.url);
}

/**
 * The cover a published blog post should get on this write: a new one when it
 * is published without a cover, and a fresh one when the title on a generated
 * cover is out of date. Drafts never get one, since covers are public. Never
 * designs a paid template, never waits past its deadline and never throws: on
 * failure the write goes ahead without a cover change.
 */
export async function generatedCoverImageUpdate(params: {
  organizationId: string;
  postId: string;
  contentType: string;
  coverImage: unknown;
  previousTitle: string;
  title: string;
  /** The post becomes published with this write. */
  publishing: boolean;
  /** The post is published after this write. */
  published: boolean;
}): Promise<PostCoverImage | null> {
  if (!(params.contentType === "blog_post" && params.published)) {
    return null;
  }
  const alt = params.title.trim().slice(0, POST_COVER_ALT_MAX_LENGTH);
  const current = postCoverImageSchema.safeParse(params.coverImage);
  const needed = isGeneratedCoverImage(params.coverImage)
    ? params.previousTitle.trim() !== params.title.trim() ||
      // Titles edited while it was a draft show up when it is republished.
      (params.publishing && current.data?.alt !== alt)
    : params.publishing && !params.coverImage;
  if (!(needed && alt)) {
    return null;
  }
  const signal = AbortSignal.timeout(GENERATED_COVER_TIMEOUT_MS);
  const work = (async () => {
    const { pngBase64 } = await renderPostOgImage({
      organizationId: params.organizationId,
      title: alt,
      cachedTemplateOnly: true,
      signal,
    });
    signal.throwIfAborted();
    const url = await uploadGeneratedCoverAsset({
      organizationId: params.organizationId,
      postId: params.postId,
      pngBase64,
      signal,
    });
    return { url, alt };
  })();
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
    ]);
  } catch (error) {
    // An upload that lands after the deadline is not referenced by any post.
    work.then((late) => discardUnusedCover(late, null)).catch(() => undefined);
    logWarn("[post-cover] Could not generate a cover image", {
      postId: params.postId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Writes the generated cover only if the stored cover is still the one it
 * replaces, so a cover someone saved meanwhile is kept.
 */
export function coverImageIfUnchanged(previous: unknown, next: PostCoverImage) {
  return sql`case when ${posts.coverImage} is not distinct from ${
    previous ? JSON.stringify(previous) : null
  }::jsonb then ${JSON.stringify(next)}::jsonb else ${posts.coverImage} end`;
}

/** Deletes a generated cover the saved post does not reference. */
export async function discardUnusedCover(
  generated: PostCoverImage | null,
  savedCoverImage: unknown
) {
  if (
    !generated ||
    postCoverImageSchema.safeParse(savedCoverImage).data?.url === generated.url
  ) {
    return;
  }
  try {
    await deleteGeneratedCoverAsset(generated.url);
  } catch (error) {
    logWarn("[post-cover] Could not delete an unused cover image", {
      url: generated.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
