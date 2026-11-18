import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  POST_AUTHORS_MAX,
  POST_TAGS_MAX,
} from "@notra/ai/constants/post-metadata";
import { supportedLanguageSchema } from "@notra/ai/schemas/language";
import {
  BRAND_AUDIENCE_MAX_LENGTH,
  BRAND_AUDIENCE_MIN_LENGTH,
  BRAND_COMPANY_DESCRIPTION_MAX_LENGTH,
  BRAND_COMPANY_DESCRIPTION_MIN_LENGTH,
  BRAND_COMPANY_NAME_MAX_LENGTH,
  BRAND_CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  BRAND_CUSTOM_TONE_MAX_LENGTH,
  BRAND_NAME_MAX_LENGTH,
  POST_MARKDOWN_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@notra/ai/schemas/limits";
import { POST_SLUG_MAX_LENGTH, POST_SLUG_REGEX } from "@notra/ai/schemas/post";
import {
  postCoverImageSchema,
  postExcerptPatchSchema,
  postTagsSchema,
} from "@notra/ai/schemas/post-metadata";
import { toneProfileSchema } from "@notra/ai/schemas/tone";
import { isValidTimezone } from "@notra/ai/utils/current-date";
import {
  CONTENT_GENERATION_ERROR_CODES,
  NO_ACTIVITY_TYPES_MESSAGE,
} from "@notra/content-generation/constants/errors";
import { CONTENT_GENERATION_BRIEF_MAX_LENGTH } from "@notra/content-generation/constants/limits";
import { SUPPORTED_CONTENT_GENERATION_TYPES } from "@notra/content-generation/schemas";
import { hasEnabledActivityType } from "@notra/content-generation/utils/sources";
import { lookbackWindowEnum, postStatusEnum } from "@notra/db/schema";
import { assertPublicHttpUrl } from "@notra/utils/url";

import { createPostFieldsSchema } from "../shared/post";
import {
  postAuthorIdsSchema,
  postDisplayDatePatchSchema,
} from "../shared/post-metadata";
import { resourceIdSchema } from "./ids";

const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
export const getPostsParamsSchema = z.object({});

const postStatusSchema = z.enum(postStatusEnum.enumValues);
const postContentTypeSchema = z.enum([
  "changelog",
  "linkedin_post",
  "twitter_post",
  "blog_post",
  "investor_update",
  "image",
]);

export const ALL_POST_STATUSES = postStatusSchema.options;
export const ALL_POST_CONTENT_TYPES = postContentTypeSchema.options;

function normalizeFilterValues<T extends string>(
  values: T | T[] | undefined,
  defaultValues: readonly T[]
): T[] {
  if (!values) {
    return [...defaultValues];
  }

  const normalized = Array.isArray(values) ? values : [values];
  if (normalized.length === 0) {
    return [...defaultValues];
  }

  return Array.from(new Set(normalized));
}

function splitQueryFilterValues(values: string | undefined): string[] {
  if (!values) {
    return [];
  }

  return values
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function validateFilterItemCount(
  parsedValues: readonly string[],
  maxItems: number,
  ctx: z.RefinementCtx
) {
  if (parsedValues.length > maxItems) {
    ctx.addIssue({
      code: "custom",
      message: `Expected at most ${maxItems} items`,
    });
  }
}

function validateEnumFilterValues<T extends string>(
  parsedValues: readonly string[],
  valueSchema: z.ZodType<T>,
  ctx: z.RefinementCtx
) {
  for (const value of parsedValues) {
    const parsedValue = valueSchema.safeParse(value);

    if (!parsedValue.success) {
      const message = parsedValue.error.issues[0]?.message ?? "Invalid value";
      ctx.addIssue({
        code: "custom",
        message,
      });
    }
  }
}

function createBaseEnumFilterSchema<T extends string>(
  valueSchema: z.ZodType<T>,
  defaultValues: readonly T[],
  maxItems: number
) {
  return z
    .string()
    .optional()
    .superRefine((values, ctx) => {
      const parsedValues = splitQueryFilterValues(values);
      validateFilterItemCount(parsedValues, maxItems, ctx);
      validateEnumFilterValues(parsedValues, valueSchema, ctx);
    })
    .transform((values: string | undefined) => {
      const parsedValues = splitQueryFilterValues(values);

      return normalizeFilterValues(
        parsedValues.map((value) => valueSchema.parse(value)),
        defaultValues
      );
    });
}

function createOpenApiEnumFilterSchema<T extends string>(
  valueSchema: z.ZodType<T>,
  defaultValues: readonly T[],
  maxItems: number,
  description: string
) {
  return createBaseEnumFilterSchema(
    valueSchema,
    defaultValues,
    maxItems
  ).openapi({ description });
}

function createBaseStringFilterSchema(maxItems: number) {
  return z
    .string()
    .optional()
    .superRefine((values, ctx) => {
      validateFilterItemCount(splitQueryFilterValues(values), maxItems, ctx);
    })
    .transform((values: string | undefined) => {
      const parsedValues = splitQueryFilterValues(values);

      return Array.from(new Set(parsedValues));
    });
}

function createOpenApiStringFilterSchema(
  maxItems: number,
  description: string
) {
  return createBaseStringFilterSchema(maxItems).openapi({ description });
}

const openApiStatusFilterSchema = createOpenApiEnumFilterSchema(
  postStatusSchema,
  ["published"],
  ALL_POST_STATUSES.length,
  "Filter by status using a comma-separated list."
);

const openApiContentTypeFilterSchema = createOpenApiEnumFilterSchema(
  postContentTypeSchema,
  ALL_POST_CONTENT_TYPES,
  ALL_POST_CONTENT_TYPES.length,
  "Filter by content type using a comma-separated list."
);

const openApiBrandIdentityIdFilterSchema = createOpenApiStringFilterSchema(
  100,
  "Comma-separated brand identity IDs. Matches posts whose sourceMetadata.brandVoiceId is one of them: posts from generation runs (POST /v1/posts/generate, schedules, event triggers and GEO content briefs), which record the brand identity they wrote in, including the default one when none was requested. Posts created with POST /v1/posts or in chat, including images generated in chat, never match."
);

export const getPostsOpenApiQuerySchema = z.object({
  sort: z.enum(["asc", "desc"]).default("desc").openapi({
    description: "Sort by creation date",
    example: "desc",
  }),
  limit: z.coerce.number().int().min(1).max(100).default(10).openapi({
    description: "Items per page",
    example: 10,
  }),
  page: z.coerce.number().int().min(1).default(1).openapi({
    description: "Page number",
    example: 1,
  }),
  status: openApiStatusFilterSchema,
  contentType: openApiContentTypeFilterSchema,
  brandIdentityId: openApiBrandIdentityIdFilterSchema,
});

export const getPostParamsSchema = z.object({
  postId: resourceIdSchema("postId").openapi({
    param: {
      in: "path",
      name: "postId",
    },
    example: "post_123",
  }),
});

export const getBrandIdentityParamsSchema = z.object({
  brandIdentityId: resourceIdSchema("brandIdentityId").openapi({
    param: {
      in: "path",
      name: "brandIdentityId",
    },
    example: "51c2f3aa-efdd-4e28-8e69-23fa2dfd3561",
  }),
});

export const getIntegrationParamsSchema = z.object({
  integrationId: resourceIdSchema("integrationId").openapi({
    param: {
      in: "path",
      name: "integrationId",
    },
    example: "51c2f3aa-efdd-4e28-8e69-23fa2dfd3561",
  }),
});

export const errorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    recovery: z.string().optional(),
  })
  .openapi("ErrorResponse");

export const organizationResponseSchema = z
  .object({
    id: z.string().openapi({
      description:
        "Workspace ID. Account API keys can send it, or the slug, as X-Notra-Organization-Id.",
    }),
    slug: z.string().openapi({
      description: "URL-safe workspace handle, unique across Notra.",
    }),
    name: z.string().openapi({ description: "Workspace display name." }),
    logo: z.string().nullable().openapi({
      description: "Workspace logo image URL. Null when none is set.",
    }),
  })
  .openapi({ description: "Workspace the request ran in." });

const websiteUrlSchema = z
  .string()
  .trim()
  .min(1, "websiteUrl is required")
  .transform((value) =>
    HTTP_PROTOCOL_REGEX.test(value) ? value : `https://${value}`
  )
  .pipe(z.string().url("Invalid website URL"))
  .superRefine((value, ctx) => {
    try {
      assertPublicHttpUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid website URL",
      });
    }
  });

const brandIdentityResponseSchema = z
  .object({
    id: z.string().openapi({
      description:
        "Pass as brandIdentityId to post generation or the brandIdentityId filter of GET /v1/posts.",
    }),
    name: z.string().openapi({
      description: "Display name, unique within the organization.",
    }),
    isDefault: z.boolean().openapi({
      description:
        "The organization's default brand identity, used when post generation omits brandIdentityId.",
    }),
    websiteUrl: z.string().openapi({
      description: "Website the identity was analyzed from.",
    }),
    companyName: z.string().nullable().openapi({
      description:
        "Filled in by the website analysis. Null until the analysis completes or when not set.",
    }),
    companyDescription: z.string().nullable().openapi({
      description:
        "Filled in by the website analysis. Null until the analysis completes or when not set.",
    }),
    toneProfile: z.string().nullable().openapi({
      description:
        "Preset tone: Conversational, Professional, Casual or Formal. Ignored while customTone is set.",
    }),
    customTone: z.string().nullable().openapi({
      description:
        "Free-text voice notes. When set, generation follows them instead of toneProfile.",
    }),
    customInstructions: z.string().nullable().openapi({
      description: "Extra writing instructions applied to generated content.",
    }),
    audience: z.string().nullable().openapi({
      description:
        "Target audience. Filled in by the website analysis; null until it completes or when not set.",
    }),
    language: z.string().nullable().openapi({
      description:
        "Language generated content is written in. Null means no language is enforced.",
    }),
    createdAt: z.string().openapi({
      description:
        "When the brand identity was created, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description:
        "When the brand identity was last changed, as an ISO 8601 timestamp.",
    }),
  })
  .openapi({
    description:
      "A brand identity with the company details, tone and audience that Notra writes content for.",
  });

const githubIntegrationResponseSchema = z
  .object({
    id: z.string().openapi({
      description:
        "GitHub integration ID. Use it in integrations.github for post generation, as integrationId for post pull requests and as repositoryId for scheduled GitHub publishing.",
    }),
    displayName: z.string().openapi({
      description:
        "Label for the repository, owner/repo when created through the API.",
    }),
    owner: z.string().nullable().openapi({
      description:
        "Repository owner (user or organization). Null only for integrations connected before Notra stored the owner and repository name on the integration; every connection path sets both today.",
    }),
    repo: z.string().nullable().openapi({
      description:
        "Repository name without the owner. Null under the same condition as owner.",
    }),
    defaultBranch: z.string().nullable().openapi({
      description:
        "Branch Notra reads activity from. Null means the repository's default branch on GitHub.",
    }),
  })
  .openapi({ description: "A GitHub repository connected to Notra." });

const linearIntegrationResponseSchema = z.object({
  id: z.string().openapi({
    description:
      "ID of the Linear integration, used in integrations.linear when generating posts.",
  }),
  displayName: z.string().openapi({
    description: "Label for the integration shown in Notra.",
  }),
  linearOrganizationId: z.string().openapi({
    description: "ID of the connected Linear workspace.",
  }),
  linearOrganizationName: z.string().nullable().openapi({
    description:
      "Name of the connected Linear workspace, or null when unknown.",
  }),
  linearTeamId: z.string().nullable().openapi({
    description:
      "Linear team that issues are read from. Null means every team in the Linear workspace.",
  }),
  linearTeamName: z.string().nullable().openapi({
    description:
      "Name of the Linear team issues are read from, or null when linearTeamId is null.",
  }),
});

const GITHUB_PAT_PREFIXES = [
  "ghp_",
  "github_pat_",
  "gho_",
  "ghu_",
  "ghs_",
  "ghr_",
] as const;

const githubPersonalAccessTokenSchema = z
  .string()
  .trim()
  .min(1, "Personal access token is required")
  .refine(
    (value) => GITHUB_PAT_PREFIXES.some((prefix) => value.startsWith(prefix)),
    "Enter a valid GitHub personal access token"
  );

export const createGitHubIntegrationRequestSchema = z.object({
  owner: z.string().trim().min(1, "Repository owner is required").openapi({
    description: "GitHub user or organization that owns the repository.",
    example: "usenotra",
  }),
  repo: z.string().trim().min(1, "Repository name is required").openapi({
    description: "Repository name without the owner.",
    example: "notra",
  }),
  branch: z.string().trim().min(1).nullable().optional().openapi({
    description:
      "Branch to read activity from. Defaults to the repository's default branch.",
    example: "main",
  }),
  token: z
    .preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }, githubPersonalAccessTokenSchema.optional().nullable())
    .openapi({
      description:
        "GitHub personal access token with read access to the repository. Required for private repositories; public repositories work without one.",
      example: "github_pat_11ABCDEFG...",
    }),
});

export const createGitHubIntegrationResponseSchema = z
  .object({
    github: githubIntegrationResponseSchema,
    organization: organizationResponseSchema,
  })
  .openapi({ description: "The newly connected GitHub repository." });

const postCoverImageResponseSchema = z
  .object({
    url: z.string().openapi({
      description:
        "Absolute https URL, or a path to an image uploaded in Notra (starting with /api/uploads/).",
      example: "https://cdn.example.com/covers/ship-notes.png",
    }),
    alt: z.string().openapi({
      description: "Alt text. Empty string when none is set.",
      example: "Screenshot of the new editor",
    }),
  })
  .openapi({
    description: "Cover image shown on post cards and social previews.",
  });

const authorProfileLinksResponseSchema = z.object({
  url: z.string().nullable().openapi({
    description: "Author's website.",
    example: "https://janedoe.dev",
  }),
  x: z.string().nullable().openapi({
    description: "X profile URL, or null when not set.",
    example: "https://x.com/janedoe",
  }),
  linkedin: z.string().nullable().openapi({
    description: "LinkedIn profile URL, or null when not set.",
  }),
  github: z.string().nullable().openapi({
    description: "GitHub profile URL, or null when not set.",
  }),
  youtube: z.string().nullable().openapi({
    description: "YouTube channel URL, or null when not set.",
  }),
  bluesky: z.string().nullable().openapi({
    description: "Bluesky profile URL, or null when not set.",
  }),
  mastodon: z.string().nullable().openapi({
    description: "Mastodon profile URL, or null when not set.",
  }),
  threads: z.string().nullable().openapi({
    description: "Threads profile URL, or null when not set.",
  }),
  instagram: z.string().nullable().openapi({
    description: "Instagram profile URL, or null when not set.",
  }),
});

const postAuthorSummarySchema = z.object({
  id: z.string().openapi({
    description:
      "Author ID from GET /v1/posts/authors, or a site:<id> ref for an author from the post's Notra Sites site.",
    example: "auth_8f2kq1",
  }),
  slug: z.string().openapi({
    description:
      "Stable author handle; hosted sites list the author's posts at /author/{slug}.",
    example: "jane-doe",
  }),
  name: z.string().openapi({
    description: "Author's display name.",
    example: "Jane Doe",
  }),
  title: z.string().nullable().openapi({
    description: "Job title shown next to the name, or null when not set.",
    example: "Head of Product",
  }),
  avatarUrl: z.string().nullable().openapi({
    description: "Avatar image URL, or null when not set.",
    example: "https://cdn.example.com/avatars/jane.png",
  }),
  ...authorProfileLinksResponseSchema.shape,
});

const postMetadataResponseSchema = z
  .object({
    coverImage: postCoverImageResponseSchema.nullable(),
    tags: z.array(z.string()).openapi({
      description: "Post tags in display order, or empty when none are set.",
      example: ["editor", "performance"],
    }),
    excerpt: z.string().nullable().openapi({
      description:
        "Summary shown on post cards and in meta descriptions. Null means it is derived from the first paragraph.",
      example: "The editor now opens twice as fast on long posts.",
    }),
    authors: z.array(postAuthorSummarySchema).openapi({
      description:
        "Credited authors in display order. Authors deleted since they were assigned are omitted. On blog posts that publish to a Notra Sites site, authors whose id starts with site: come from the site's blog.json, unpublished Design changes included.",
    }),
    featured: z.boolean().openapi({
      description: "Pinned to the top of the blog index on hosted sites.",
      example: false,
    }),
    noindex: z.boolean().openapi({
      description:
        "Asks search engines not to index the post and leaves it out of the sitemap.",
      example: false,
    }),
    hidden: z.boolean().openapi({
      description:
        "Reachable by direct link, but excluded from hosted site listings, feeds, search engine indexing, sitemaps and generated AI indexes. Not private.",
      example: false,
    }),
    displayDate: z.string().nullable().openapi({
      description:
        "Date shown on the post as YYYY-MM-DD. Null means the publish date is used.",
      example: "2026-10-01",
    }),
  })
  .openapi({
    description:
      "Site metadata for blog posts and changelogs, written into the frontmatter when the post is published to a site.",
  });

const postResponseSchema = z
  .object({
    id: z.string().openapi({
      description: "ID of the post, used as postId in the /v1/posts endpoints.",
    }),
    title: z.string().openapi({ description: "Post title." }),
    slug: z.string().nullable().openapi({
      description:
        "URL slug. Only blog posts and changelogs have one; null when none is set.",
    }),
    content: z.string().openapi({
      description:
        "Rendered HTML for text posts. For image posts, this is the public CDN URL of the rendered image.",
    }),
    htmlUrl: z.string().nullable().openapi({
      description:
        "Public CDN URL of the generated HTML artifact for image posts. Null for non-image posts.",
    }),
    markdown: z.string().nullable().openapi({
      description: "Markdown source for text posts. Null for image posts.",
    }),
    rawHtml: z.string().nullable().openapi({
      description:
        "Legacy inline generated HTML for image posts. New generated image HTML is stored as htmlUrl. Null for non-image posts.",
    }),
    recommendations: z.string().nullable().openapi({
      description:
        "Publishing suggestions written by the generator as Markdown, such as when and where to share the post. Null when there are none.",
    }),
    contentType: postContentTypeSchema.openapi({
      description:
        "Kind of content. image posts hold a rendered image instead of text; only blog_post and changelog have a slug and metadata.",
    }),
    sourceMetadata: z.unknown().nullable().openapi({
      description:
        "Free-form JSON recorded by whatever produced the post, such as a generation run or chat. Null for posts created with POST /v1/posts. Posts from generation runs (POST /v1/posts/generate, schedules, event triggers and GEO content briefs) include brandVoiceId, the brand identity the run wrote in (absent when the workspace had none), which the brandIdentityId filter of GET /v1/posts reads.",
    }),
    metadata: postMetadataResponseSchema.nullable().openapi({
      description:
        "Cover image, tags, excerpt, authors and other site metadata. Set for blog posts and changelogs, null for every other content type.",
    }),
    status: postStatusSchema.openapi({
      description:
        "Publishing state of the post in Notra, where GET /v1/posts only returns published posts unless its status filter includes draft.",
    }),
    createdAt: z.string().openapi({
      description: "When the post was created, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the post was last changed, as an ISO 8601 timestamp.",
    }),
  })
  .openapi({ description: "A post with its content and site metadata." });

const postsPaginationSchema = z
  .object({
    limit: z.number().int().min(1).openapi({
      description: "Maximum number of posts per page.",
    }),
    currentPage: z.number().int().min(1).openapi({
      description: "Page returned, starting at 1.",
    }),
    nextPage: z.number().int().min(1).nullable().openapi({
      description: "Null on the last page.",
    }),
    previousPage: z.number().int().min(1).nullable().openapi({
      description: "Null on the first page.",
    }),
    totalPages: z.number().int().min(1).openapi({
      description: "At least 1, even when no posts match.",
    }),
    totalItems: z.number().int().min(0).openapi({
      description: "Posts matching the filters across all pages.",
    }),
  })
  .openapi({ description: "Page position and totals for the post list." });

export const getPostsResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    posts: z.array(postResponseSchema).openapi({
      description:
        "Posts on this page matching the filters, in the requested sort order.",
    }),
    pagination: postsPaginationSchema,
  })
  .openapi({ description: "One page of posts and the pagination state." });

export const getPostResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    post: postResponseSchema.nullable().openapi({
      description:
        "Null when no post with this ID exists in the organization; the response is still 200.",
    }),
  })
  .openapi({
    description: "The requested post, or null when it does not exist.",
  });

const patchPostMetadataRequestSchema = z
  .object({
    coverImage: postCoverImageSchema
      .nullable()
      .optional()
      .openapi({
        description:
          "Cover image as { url, alt }. url must be an https URL (or a Notra upload path returned by the dashboard). Send null to remove the cover.",
        example: {
          url: "https://cdn.example.com/covers/ship-notes.png",
          alt: "Screenshot of the new editor",
        },
      }),
    tags: postTagsSchema.optional().openapi({
      description: `Replaces all tags. Up to ${POST_TAGS_MAX} tags; duplicates are dropped case-insensitively, keeping the first spelling. Send [] to clear.`,
      example: ["editor", "performance"],
    }),
    excerpt: postExcerptPatchSchema.optional().openapi({
      description:
        "Custom summary for post cards and meta descriptions. Send null or an empty string to derive it from the first paragraph again.",
      example: "The editor now opens twice as fast on long posts.",
    }),
    authorIds: postAuthorIdsSchema.optional().openapi({
      description: `Replaces the credited authors, in display order. Up to ${POST_AUTHORS_MAX} IDs from GET /v1/posts/authors. A blog post that publishes to a Notra Sites site can also credit the site's own authors as site:<id>, the ref from GET /v1/sites/{siteId}/authors. Send [] to clear.`,
      example: ["auth_8f2kq1"],
    }),
    featured: z.boolean().optional().openapi({
      description: "Pin the post to the top of the blog index.",
      example: true,
    }),
    noindex: z.boolean().optional().openapi({
      description:
        "Ask search engines not to index the post and leave it out of the sitemap.",
      example: false,
    }),
    hidden: z.boolean().optional().openapi({
      description:
        "Hide the post from hosted site listings, feeds, search engine indexing, sitemaps and generated AI indexes while keeping its direct URL accessible. Not private.",
      example: true,
    }),
    displayDate: postDisplayDatePatchSchema.optional().openapi({
      description:
        "Date shown on the post as YYYY-MM-DD. Send null to fall back to the publish date.",
      example: "2026-10-01",
    }),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one metadata field must be provided",
  })
  .openapi({
    description:
      "Site metadata for blog posts and changelogs. Send only the fields you want to change. Rejected with 400 for other content types.",
  });

export const patchPostRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(POST_TITLE_MAX_LENGTH)
      .optional()
      .openapi({
        example: "Ship notes for week 11",
      }),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(POST_SLUG_MAX_LENGTH)
      .regex(
        POST_SLUG_REGEX,
        "Slug must contain lowercase letters, numbers, and hyphens only"
      )
      .nullable()
      .optional()
      .openapi({
        example: "ship-notes-week-11",
      }),
    markdown: z
      .string()
      .min(1)
      .max(POST_MARKDOWN_MAX_LENGTH)
      .optional()
      .openapi({
        example: "# Ship notes\n\nWe shipped a faster editor.",
      }),
    status: postStatusSchema.optional().openapi({
      example: "published",
    }),
    metadata: patchPostMetadataRequestSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.slug !== undefined ||
      data.markdown !== undefined ||
      data.status !== undefined ||
      data.metadata !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export const patchPostResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    post: postResponseSchema.openapi({
      description: "The post after the update was saved.",
    }),
  })
  .openapi({ description: "The updated post." });

const contentAuthorResponseSchema = z.object({
  id: z.string().openapi({
    description: "Pass this ID in metadata.authorIds when updating a post.",
    example: "auth_8f2kq1",
  }),
  slug: z.string().openapi({
    description:
      "Stable author handle; hosted sites list the author's posts at /author/{slug}.",
    example: "jane-doe",
  }),
  name: z.string().openapi({
    description: "Author's display name.",
    example: "Jane Doe",
  }),
  title: z.string().nullable().openapi({
    description: "Job title shown next to the name, or null when not set.",
    example: "Head of Product",
  }),
  bio: z.string().nullable().openapi({
    description: "Short author bio, or null when not set.",
  }),
  avatarUrl: z.string().nullable().openapi({
    description: "Avatar image URL, or null when not set.",
  }),
  ...authorProfileLinksResponseSchema.shape,
});

export const listPostAuthorsResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    authors: z.array(contentAuthorResponseSchema).openapi({
      description: "Every author in the organization, sorted by name.",
    }),
  })
  .openapi({ description: "Authors that can be credited on posts." });

export const createPostRequestSchema = createPostFieldsSchema
  .extend({
    status: postStatusSchema.default("draft"),
  })
  .openapi({
    description:
      "Slugs are normalized to lowercase letters, numbers, and hyphens and only accepted for blog posts and changelogs. Omit markdown to create an empty post you fill in later.",
    example: {
      title: "Ship notes for week 11",
      contentType: "blog_post",
      slug: "ship-notes-week-11",
      status: "draft",
    },
  });

export const createPostResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    post: postResponseSchema.openapi({ description: "The created post." }),
  })
  .openapi({ description: "The newly created post." });

export const createBrandIdentityRequestSchema = z.object({
  name: z.string().trim().min(1).max(BRAND_NAME_MAX_LENGTH).optional().openapi({
    description:
      'Display name. Must be unique within the organization. Defaults to "Untitled Brand Voice".',
    example: "Notra",
  }),
  websiteUrl: websiteUrlSchema.openapi({
    description:
      "Public website to analyze for company details, tone, and audience. The scheme is optional; https is assumed.",
    example: "https://usenotra.com",
  }),
});

const brandAnalysisJobSchema = z
  .object({
    id: z.string().openapi({
      description:
        "ID of the job, which you poll with GET /v1/brand-identities/generate/{jobId}.",
    }),
    organizationId: z.string().openapi({
      description: "Workspace the job runs in.",
    }),
    brandIdentityId: z.string().openapi({
      description:
        "ID of the brand identity being analyzed. The identity is created immediately and its details are filled in as the job completes.",
    }),
    status: z.enum(["queued", "running", "completed", "failed"]).openapi({
      description: "Job state. Stop polling once it is completed or failed.",
    }),
    step: z.enum(["scraping", "extracting", "saving"]).nullable().openapi({
      description: "Current analysis step while the job is running.",
    }),
    currentStep: z.number().int().min(0).openapi({
      description: "Progress through the analysis, out of totalSteps.",
    }),
    totalSteps: z.number().int().min(1).openapi({
      description: "Number of steps the analysis takes.",
    }),
    workflowRunId: z.string().nullable().openapi({
      description:
        "Internal workflow run ID. Null until the analysis workflow has started.",
    }),
    error: z.string().nullable().openapi({
      description: "Failure reason when status is failed.",
    }),
    createdAt: z.string().openapi({
      description: "When the job was queued, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the job last changed, as an ISO 8601 timestamp.",
    }),
    completedAt: z.string().nullable().openapi({
      description:
        "When the job completed or failed. Null while it is queued or running.",
    }),
  })
  .openapi({
    description:
      "Website analysis job that fills in a brand identity's details.",
  });

export const createBrandIdentityResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    job: brandAnalysisJobSchema,
  })
  .openapi({
    description:
      "The queued analysis job for the new brand identity, which you poll until its status is completed or failed.",
  });

export const getBrandAnalysisJobParamsSchema = z.object({
  jobId: resourceIdSchema("jobId").openapi({
    param: {
      in: "path",
      name: "jobId",
    },
    description: "Job ID returned by POST /v1/brand-identities/generate.",
    example: "brand_job_5f0c3b2a9d4e4c1f8a7b6c5d4e3f2a1b",
  }),
});

export const getBrandAnalysisJobResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    job: brandAnalysisJobSchema,
  })
  .openapi({ description: "Current state of the brand analysis job." });

export const patchBrandIdentityRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(BRAND_NAME_MAX_LENGTH)
      .optional()
      .openapi({
        example: "Notra",
      }),
    websiteUrl: websiteUrlSchema.optional().openapi({
      example: "https://usenotra.com",
    }),
    companyName: z
      .string()
      .trim()
      .min(1)
      .max(BRAND_COMPANY_NAME_MAX_LENGTH)
      .optional()
      .nullable()
      .openapi({
        example: "Notra",
      }),
    companyDescription: z
      .string()
      .trim()
      .min(BRAND_COMPANY_DESCRIPTION_MIN_LENGTH)
      .max(BRAND_COMPANY_DESCRIPTION_MAX_LENGTH)
      .optional()
      .nullable()
      .openapi({
        example: "AI-native content workflows for software teams.",
      }),
    toneProfile: toneProfileSchema.optional().nullable().openapi({
      example: "Professional",
      description:
        "Set a preset tone profile. When provided without customTone, any saved custom tone is cleared.",
    }),
    customTone: z
      .string()
      .trim()
      .max(BRAND_CUSTOM_TONE_MAX_LENGTH)
      .optional()
      .nullable()
      .openapi({
        example: "Clear, direct, and technically confident",
        description:
          "Provide a custom tone override. Send an empty string or null to clear it.",
      }),
    customInstructions: z
      .string()
      .trim()
      .max(BRAND_CUSTOM_INSTRUCTIONS_MAX_LENGTH)
      .optional()
      .nullable()
      .openapi({
        example: "Avoid hype. Prioritize concrete examples.",
      }),
    audience: z
      .string()
      .trim()
      .min(BRAND_AUDIENCE_MIN_LENGTH)
      .max(BRAND_AUDIENCE_MAX_LENGTH)
      .optional()
      .nullable()
      .openapi({
        example: "Engineering leaders and developer tooling teams.",
      }),
    language: supportedLanguageSchema.optional().nullable().openapi({
      example: "English",
    }),
    isDefault: z.literal(true).optional().openapi({
      example: true,
      description:
        "Set this brand identity as the organization's default. Only true is accepted.",
    }),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.websiteUrl !== undefined ||
      data.companyName !== undefined ||
      data.companyDescription !== undefined ||
      data.toneProfile !== undefined ||
      data.customTone !== undefined ||
      data.customInstructions !== undefined ||
      data.audience !== undefined ||
      data.language !== undefined ||
      data.isDefault !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export const patchBrandIdentityResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    brandIdentity: brandIdentityResponseSchema.openapi({
      description: "The brand identity after the update was saved.",
    }),
  })
  .openapi({ description: "The updated brand identity." });

const disabledTriggerSchema = z.object({
  id: z.string().openapi({ description: "Automation trigger ID." }),
  name: z.string().openapi({
    description:
      'Trigger name. Event triggers always have the default "Untitled Schedule".',
  }),
});

const disabledSchedulesSchema = z.array(disabledTriggerSchema).openapi({
  description:
    "Schedules that targeted the deleted resource. They are kept but set to enabled: false and stop running. IDs work with the /v1/schedules endpoints.",
});

const disabledEventsSchema = z.array(disabledTriggerSchema).openapi({
  description:
    "Event triggers that targeted the deleted resource. They are kept but set to enabled: false and ignore GitHub events. IDs work with the /v1/event-triggers endpoints.",
});

export const deleteBrandIdentityResponseSchema = z
  .object({
    id: z
      .string()
      .openapi({ description: "ID of the deleted brand identity." }),
    organization: organizationResponseSchema,
    disabledSchedules: disabledSchedulesSchema,
    disabledEvents: disabledEventsSchema,
  })
  .openapi({
    description:
      "The deleted brand identity and the automations that were disabled because they used it.",
  });

export const deletePostResponseSchema = z
  .object({
    id: z.string().openapi({ description: "ID of the deleted post." }),
    organization: organizationResponseSchema,
  })
  .openapi({ description: "Confirmation that the post was deleted." });

export const deleteIntegrationResponseSchema = z
  .object({
    id: z.string().openapi({ description: "ID of the deleted integration." }),
    organization: organizationResponseSchema,
    disabledSchedules: disabledSchedulesSchema,
    disabledEvents: disabledEventsSchema,
  })
  .openapi({
    description:
      "The deleted integration and the automations that were disabled because they used it.",
  });

export const getBrandIdentitiesResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    brandIdentities: z.array(brandIdentityResponseSchema).openapi({
      description: "Every brand identity in the organization, default first.",
    }),
  })
  .openapi({ description: "The organization's brand identities." });

export const getBrandIdentityResponseSchema = z
  .object({
    brandIdentity: brandIdentityResponseSchema.nullable().openapi({
      description:
        "Null when no brand identity with this ID exists in the organization; the response is still 200.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi({
    description:
      "The requested brand identity, or null when it does not exist.",
  });

export const GITHUB_ACTIVITY_TYPES = [
  "pull_requests",
  "commits",
  "releases",
] as const;

export const getGitHubActivityQuerySchema = z
  .object({
    type: z.enum(GITHUB_ACTIVITY_TYPES).default("pull_requests").openapi({
      description:
        "Activity to list: pull requests merged into the default branch, commits on the default branch, or releases published in the repository.",
      example: "pull_requests",
    }),
    since: z.iso.datetime({ offset: true }).optional().openapi({
      description:
        "Start of the window (ISO 8601). Defaults to 7 days before until.",
      example: "2026-10-23T00:00:00Z",
    }),
    until: z.iso.datetime({ offset: true }).optional().openapi({
      description: "End of the window (ISO 8601). Defaults to now.",
      example: "2026-10-30T00:00:00Z",
    }),
    page: z.coerce.number().int().min(1).default(1).openapi({
      description: "Page number",
      example: 1,
    }),
  })
  .refine(
    ({ since, until }) =>
      !since || Date.parse(since) < (until ? Date.parse(until) : Date.now()),
    { message: "since must be before until", path: ["since"] }
  );

const githubActivityItemSchema = z.object({
  ref: z.string().openapi({
    description:
      "Pull request number as a string, full commit SHA or release tag name, depending on type.",
    example: "482",
  }),
  title: z.string().openapi({
    description:
      "Pull request title, first line of the commit message, or release name (the tag name when the release has none).",
  }),
  body: z.string().nullable().openapi({
    description:
      "Pull request description, rest of the commit message after the first line, or release notes. Null when empty.",
  }),
  author: z.string().nullable().openapi({
    description:
      "GitHub login of the author. For commits without a linked GitHub account, the Git author name.",
  }),
  url: z.string().openapi({
    description: "Link to the pull request, commit or release on GitHub.",
  }),
  occurredAt: z.string().openapi({
    description: "Merge, commit or publish time (ISO 8601).",
  }),
});

export const getGitHubActivityResponseSchema = z
  .object({
    integration: githubIntegrationResponseSchema.openapi({
      description: "The repository the activity was read from.",
    }),
    type: z.enum(GITHUB_ACTIVITY_TYPES).openapi({
      description: "Kind of activity listed in items.",
    }),
    since: z.string().openapi({
      description:
        "Start of the window used (ISO 8601), after defaults are applied.",
    }),
    until: z.string().openapi({
      description:
        "End of the window used (ISO 8601), after defaults are applied.",
    }),
    items: z.array(githubActivityItemSchema).openapi({
      description:
        "Pull requests, commits or releases in the window on this page.",
    }),
    pagination: z
      .object({
        page: z
          .number()
          .int()
          .openapi({ description: "Page returned, starting at 1." }),
        nextPage: z.number().int().nullable().openapi({
          description:
            "Next GitHub page to request, or null when there are no more items in the window. A page can hold fewer items than the page size while nextPage is set.",
        }),
      })
      .openapi({ description: "Page position in the activity list." }),
    organization: organizationResponseSchema,
  })
  .openapi({
    description: "One page of GitHub activity for a connected repository.",
  });

export const getIntegrationsResponseSchema = z
  .object({
    github: z.array(githubIntegrationResponseSchema).openapi({
      description:
        "Enabled GitHub integrations. One entry per connected repository.",
    }),
    slack: z.array(z.unknown()).openapi({
      description:
        "Always empty. Slack is connected from the dashboard and is not exposed through the API.",
    }),
    linear: z.array(linearIntegrationResponseSchema).openapi({
      description: "Enabled Linear integrations.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi({ description: "The organization's connected integrations." });

export const generationQueueErrorResponseSchema = z.object({
  error: z.string(),
  jobId: z.string().optional(),
});

const contentGenerationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "skipped",
]);

const contentGenerationLookbackWindowSchema = z.enum(
  lookbackWindowEnum.enumValues
);

const contentGenerationTypeSchema = z.enum(SUPPORTED_CONTENT_GENERATION_TYPES);

export const createPostGenerationRequestSchema = z
  .object({
    contentType: contentGenerationTypeSchema.openapi({
      description: "Type of content to generate.",
      example: "blog_post",
    }),
    lookbackWindow: contentGenerationLookbackWindowSchema
      .default("last_7_days")
      .openapi({
        description:
          "How far back to collect source activity (commits, pull requests, releases, Linear issues).",
        example: "last_7_days",
      }),
    brandVoiceId: z.string().min(1).optional().openapi({
      description: "Deprecated. Use brandIdentityId instead.",
      example: "51c2f3aa-efdd-4e28-8e69-23fa2dfd3561",
    }),
    brandIdentityId: z.string().min(1).nullable().optional().openapi({
      description:
        "Brand identity to write in. Defaults to the organization's default brand identity.",
      example: "51c2f3aa-efdd-4e28-8e69-23fa2dfd3561",
    }),
    repositoryIds: z
      .array(z.string().min(1))
      .optional()
      .openapi({
        example: ["repo_1", "repo_2"],
        description:
          "Deprecated. Use integrations.github with GitHub integration IDs instead.",
      }),
    linearIntegrationIds: z
      .array(z.string().min(1))
      .optional()
      .openapi({
        example: ["linear_integration_1"],
        description:
          "Deprecated. Use integrations.linear with Linear integration IDs instead.",
      }),
    integrations: z
      .object({
        github: z
          .array(z.string().min(1))
          .min(1)
          .optional()
          .openapi({
            description:
              "GitHub integration IDs to use as sources, as returned by GET /v1/integrations.",
            example: ["integration_1", "integration_2"],
          }),
        linear: z
          .array(z.string().min(1))
          .min(1)
          .optional()
          .openapi({
            description:
              "Linear integration IDs to use as sources, as returned by GET /v1/integrations.",
            example: ["linear_integration_1"],
          }),
      })
      .optional()
      .openapi({
        description:
          "Source integrations to draw activity from. Omit this and github.repositories to use every connected GitHub integration.",
      }),
    github: z
      .object({
        repositories: z
          .array(
            z.object({
              owner: z.string().min(1),
              repo: z.string().min(1),
            })
          )
          .min(1),
      })
      .optional()
      .openapi({
        description:
          "Select connected repositories by owner and name instead of integration ID. Cannot be combined with integrations.github.",
        example: {
          repositories: [{ owner: "usenotra", repo: "notra" }],
        },
      }),
    dataPoints: z
      .object({
        includePullRequests: z.boolean().default(true),
        includeCommits: z.boolean().default(true),
        includeReleases: z.boolean().default(true),
        includeLinearData: z.boolean().default(false),
      })
      .default({
        includePullRequests: true,
        includeCommits: true,
        includeReleases: true,
        includeLinearData: false,
      })
      .openapi({
        description:
          "Which kinds of activity to collect from the selected sources. At least one must be true, unless pullRequest is set, which ignores them.",
      }),
    selectedItems: z
      .object({
        commitShas: z.array(z.string()).optional(),
        pullRequestNumbers: z
          .array(
            z.object({
              repositoryId: z.string(),
              number: z.number(),
            })
          )
          .optional(),
        releaseTagNames: z
          .array(
            z.union([
              z.string(),
              z.object({
                repositoryId: z.string(),
                tagName: z.string(),
              }),
            ])
          )
          .optional(),
        linearIssueIds: z
          .array(
            z.object({
              integrationId: z.string(),
              issueId: z.string(),
            })
          )
          .optional(),
      })
      .optional()
      .openapi({
        description:
          "Restrict generation to specific commits, pull requests, releases, or Linear issues instead of everything in the lookback window.",
      }),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .refine((value) => value === undefined || isValidTimezone(value), {
        message: "Invalid timezone",
      })
      .openapi({
        description:
          "IANA timezone used for relative lookback windows such as current_day and yesterday.",
        example: "America/New_York",
      }),
    pullRequest: z
      .object({
        owner: z.string().trim().min(1),
        repo: z.string().trim().min(1),
        number: z.number().int().positive(),
      })
      .optional()
      .openapi({
        description:
          "Write about exactly this pull request in a connected repository, open or merged, whatever its age. Uses only its pull request data, so dataPoints and lookbackWindow do not apply. Cannot be combined with other source selectors or selectedItems.",
        example: { owner: "usenotra", repo: "notra", number: 2385 },
      }),
    brief: z
      .string()
      .trim()
      .min(1)
      .max(CONTENT_GENERATION_BRIEF_MAX_LENGTH)
      .optional()
      .openapi({
        description:
          "What the post should be about and what it should cover, in your own words. Steers the topic, angle and structure; facts still come from the selected sources.",
        example:
          "Announce mention-driven blog posts. Lead with the phone workflow and show the comment that triggers it.",
      }),
  })
  // Checked here rather than on dataPoints, which pullRequest replaces.
  .refine(
    (value) =>
      Boolean(value.pullRequest) || hasEnabledActivityType(value.dataPoints),
    {
      message: NO_ACTIVITY_TYPES_MESSAGE,
      path: ["dataPoints"],
      params: {
        code: CONTENT_GENERATION_ERROR_CODES.NO_ACTIVITY_TYPES_SELECTED,
      },
    }
  )
  .refine(
    (value) =>
      !value.pullRequest ||
      !(
        value.repositoryIds?.length ||
        value.integrations?.github?.length ||
        value.integrations?.linear?.length ||
        value.linearIntegrationIds?.length ||
        value.github?.repositories?.length ||
        value.selectedItems
      ),
    {
      message:
        "pullRequest selects its own source. Do not combine it with integrations, repositoryIds, linearIntegrationIds, github.repositories or selectedItems.",
      path: ["pullRequest"],
    }
  )
  .refine(
    (value) => {
      const repositorySourceCount = [
        value.repositoryIds?.length ? 1 : 0,
        value.integrations?.github?.length ? 1 : 0,
        value.github?.repositories?.length ? 1 : 0,
      ].reduce((sum, count) => sum + count, 0);

      return repositorySourceCount <= 1;
    },
    {
      message:
        "Provide only one GitHub source selector: integrations.github or github.repositories. repositoryIds is deprecated.",
      path: ["integrations"],
    }
  )
  .refine(
    (value) => {
      const linearSourceCount = [
        value.linearIntegrationIds?.length ? 1 : 0,
        value.integrations?.linear?.length ? 1 : 0,
      ].reduce((sum, count) => sum + count, 0);

      return linearSourceCount <= 1;
    },
    {
      message:
        "Provide only one Linear source selector: integrations.linear. linearIntegrationIds is deprecated.",
      path: ["integrations"],
    }
  )
  .refine(
    (value) =>
      value.brandVoiceId === undefined || value.brandIdentityId === undefined,
    {
      message: "Provide either brandVoiceId or brandIdentityId, not both",
      path: ["brandIdentityId"],
    }
  );

const contentGenerationJobEventSchema = z.object({
  id: z.string().openapi({ description: "Event ID." }),
  jobId: z.string().openapi({ description: "Job the event belongs to." }),
  type: z
    .enum([
      "queued",
      "workflow_triggered",
      "running",
      "fetching_repositories",
      "generating_content",
      "post_created",
      "completed",
      "failed",
      "skipped",
    ])
    .openapi({
      description: "Step of the job the event records.",
    }),
  message: z.string().openapi({
    description: "Human-readable description of the event.",
  }),
  createdAt: z.string().openapi({
    description: "When the event was recorded, as an ISO 8601 timestamp.",
  }),
  metadata: z.record(z.string(), z.unknown()).nullable().openapi({
    description:
      "Event details that vary by type, such as postId on post_created and completed, or errorCode on failed and skipped.",
  }),
});

const contentGenerationJobSchema = z
  .object({
    id: z.string().openapi({
      description:
        "ID of the job, which you poll with GET /v1/posts/generate/{jobId}.",
    }),
    organizationId: z.string().openapi({
      description: "Workspace the job runs in.",
    }),
    status: contentGenerationStatusSchema.openapi({
      description:
        "Job state. Terminal states are completed, failed, and skipped.",
    }),
    contentType: contentGenerationTypeSchema.openapi({
      description: "Type of content being generated.",
    }),
    lookbackWindow: contentGenerationLookbackWindowSchema.openapi({
      description: "How far back source activity is collected.",
    }),
    repositoryIds: z.array(z.string()).openapi({
      description:
        "Selected GitHub integration IDs. Empty when no GitHub source was selected. Every connected GitHub integration is used only when neither a GitHub nor a Linear source was selected.",
    }),
    brandVoiceId: z.string().nullable().openapi({
      description:
        "Brand identity the post is written in: the requested one, else the default, else the most recently updated. Null when the organization has none.",
    }),
    workflowRunId: z.string().nullable().openapi({
      description:
        "Internal workflow run ID. Null until the generation workflow has started.",
    }),
    postId: z.string().nullable().openapi({
      description:
        "ID of the generated post. Set once the job reaches completed.",
    }),
    error: z.string().nullable().openapi({
      description:
        "Failure reason when status is failed, or why generation was skipped (for example no meaningful source activity) when status is skipped.",
    }),
    errorCode: z.string().nullable().optional().openapi({
      description:
        "Stable machine-readable failure code when status is failed, such as NO_ACTIVITY_TYPES_SELECTED or NO_AVAILABLE_SOURCES. Absent or null for other failures and for older jobs.",
      example: "NO_AVAILABLE_SOURCES",
    }),
    source: z.enum(["api", "dashboard"]).openapi({
      description: "Where the job was started.",
    }),
    createdAt: z.string().openapi({
      description: "When the job was queued, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the job last changed, as an ISO 8601 timestamp.",
    }),
    completedAt: z.string().nullable().openapi({
      description:
        "When the job reached completed, failed or skipped. Null while it is queued or running.",
    }),
  })
  .openapi({ description: "Asynchronous post generation job." });

export const createPostGenerationResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    job: contentGenerationJobSchema,
  })
  .openapi({
    description:
      "The queued generation job, which you poll until its status is completed, failed or skipped.",
  });

export const createPostPullRequestRequestSchema = z
  .object({
    integrationId: z.string().trim().min(1).optional().openapi({
      description:
        "GitHub integration ID from GET /v1/integrations to open the pull request in.",
      example: "integration_1",
    }),
    github: z
      .object({
        owner: z.string().trim().min(1),
        repo: z.string().trim().min(1),
      })
      .optional()
      .openapi({
        description:
          "Connected repository by owner and name, instead of integrationId.",
        example: { owner: "usenotra", repo: "notra" },
      }),
  })
  .refine((value) => !(value.integrationId && value.github), {
    message: "Provide either integrationId or github, not both",
    path: ["github"],
  })
  .openapi({
    description:
      "Where to open the pull request. Omit both fields when the organization has exactly one connected GitHub repository.",
  });

export const createPostPullRequestResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    pullRequest: z
      .object({
        number: z.number().int().positive().openapi({
          description: "Pull request number on GitHub.",
        }),
        url: z.url().openapi({ description: "Pull request URL on GitHub." }),
        branchName: z.string().openapi({
          description: "Head branch of the pull request.",
        }),
        path: z.string().openapi({
          description: "Repository path of the post file on the branch.",
        }),
        operation: z.enum(["created", "updated"]).openapi({
          description:
            "created for a new draft pull request, updated when the post's open pull request was refreshed instead.",
        }),
      })
      .openapi({ description: "The draft pull request holding the post." }),
  })
  .openapi({
    description: "The pull request that adds the post to the repository.",
  });

export const getPostGenerationParamsSchema = z.object({
  jobId: resourceIdSchema("jobId").openapi({
    param: {
      in: "path",
      name: "jobId",
    },
    description: "Job ID returned by POST /v1/posts/generate.",
    example: "job_5f0c3b2a9d4e4c1f8a7b6c5d4e3f2a1b",
  }),
});

export const getPostGenerationResponseSchema = z
  .object({
    job: contentGenerationJobSchema,
    events: z.array(contentGenerationJobEventSchema).openapi({
      description:
        "The job's event log, oldest first, up to the 100 most recent events.",
    }),
  })
  .openapi({
    description: "Current state of the post generation job and its event log.",
  });
