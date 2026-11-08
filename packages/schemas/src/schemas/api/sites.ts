import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  SITE_AUTHOR_AVATAR,
  SITE_AUTHOR_ID,
} from "@notra/sites-core/constants/site-config";
import { SITE_AUTHOR_PAGE_LAYOUTS } from "@notra/sites-core/constants/site-layout";

import {
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
  SITE_AUTHOR_BIO_MAX_LENGTH,
} from "../../constants/dashboard/post-metadata";
import { siteAuthorLinkSchema } from "../shared/site-authors";
import { resourceIdSchema } from "./ids";

const SITE_AUTHOR_ID_MESSAGE =
  "Use 1 to 40 lowercase letters, digits and dashes, starting and ending with a letter or digit";

const siteAuthorIdSchema = z
  .string()
  .trim()
  .regex(SITE_AUTHOR_ID, SITE_AUTHOR_ID_MESSAGE);

export const siteParamsSchema = z.object({
  siteId: resourceIdSchema("siteId").openapi({
    param: { in: "path", name: "siteId" },
    example: "site_8f2kq1",
  }),
});

export const siteAuthorParamsSchema = siteParamsSchema.extend({
  authorId: siteAuthorIdSchema.openapi({
    param: { in: "path", name: "authorId" },
    description:
      "The author's id in blog.json. Posts name the author with it and its author page lives at {blogMount}/author/{authorId}.",
    example: "jane-doe",
  }),
});

const siteSummarySchema = z
  .object({
    id: z.string().openapi({ example: "site_8f2kq1" }),
    name: z.string().openapi({ example: "Acme" }),
    url: z.string().openapi({
      description: "Where the site serves its first area, such as its blog.",
      example: "https://acme.notra.site/blog",
    }),
    status: z.string().openapi({
      description: "active, or suspended while the site is paused.",
      example: "active",
    }),
    live: z.boolean().openapi({
      description: "The site has a production deployment serving visitors.",
      example: true,
    }),
    blogMount: z.string().nullable().openapi({
      description:
        "Path the blog is served under, or null when the site has no blog. Only sites with a blog have authors.",
      example: "/blog",
    }),
  })
  .openapi("Site");

export const listSitesResponseSchema = z.object({
  sites: z.array(siteSummarySchema),
});

const siteAuthorLinksSchema = z.object({
  url: z.string().nullable().openapi({ example: "https://janedoe.dev" }),
  x: z.string().nullable().openapi({ example: "https://x.com/janedoe" }),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  youtube: z.string().nullable(),
  bluesky: z.string().nullable(),
  mastodon: z.string().nullable(),
  threads: z.string().nullable(),
  instagram: z.string().nullable(),
});

const siteAuthorSchema = z
  .object({
    id: z.string().openapi({ example: "jane-doe" }),
    ref: z.string().openapi({
      description:
        "Pass this in metadata.authorIds of PATCH /v1/posts/{postId} to credit the author on a blog post that publishes to this site.",
      example: "site:jane-doe",
    }),
    name: z.string().openapi({ example: "Jane Doe" }),
    title: z.string().nullable().openapi({ example: "Head of Product" }),
    bio: z.string().nullable(),
    avatar: z.string().nullable().openapi({
      description:
        "As written in blog.json: a site path such as /images/jane.png or an https URL.",
      example: "/images/jane.png",
    }),
    avatarUrl: z.string().nullable().openapi({
      description: "The avatar as a full URL on the live site.",
      example: "https://acme.notra.site/blog/images/jane.png",
    }),
    ...siteAuthorLinksSchema.shape,
    live: z.boolean().openapi({
      description:
        "The author is in the published blog.json. False while it only exists in unpublished changes.",
      example: true,
    }),
    posts: z.number().int().openapi({
      description: "Notra blog posts on this site that credit the author.",
      example: 3,
    }),
  })
  .openapi("SiteAuthor");

export const siteAuthorsResponseSchema = z
  .object({
    site: z.object({ id: z.string(), name: z.string() }),
    authors: z.array(siteAuthorSchema).openapi({
      description: "Authors in blog.json order, including unpublished changes.",
    }),
    authorPage: z.enum(SITE_AUTHOR_PAGE_LAYOUTS).openapi({
      description:
        "Layout of every author page: inline puts the avatar beside the name, stacked puts it above.",
      example: "inline",
    }),
    hasUnpublishedChanges: z.boolean().openapi({
      description:
        "blog.json has staged Design changes that are not live yet. Publish them with POST /v1/sites/{siteId}/publish or from the dashboard.",
      example: true,
    }),
  })
  .openapi("SiteAuthors");

const optionalTextSchema = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const optionalLinkSchema = siteAuthorLinkSchema.nullable().optional();

export const putSiteAuthorRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(CONTENT_AUTHOR_NAME_MAX_LENGTH),
    title: optionalTextSchema(CONTENT_AUTHOR_TITLE_MAX_LENGTH),
    bio: optionalTextSchema(SITE_AUTHOR_BIO_MAX_LENGTH),
    avatar: z
      .string()
      .trim()
      .regex(
        SITE_AUTHOR_AVATAR,
        "Use a site path like /images/jane.png or an https:// URL"
      )
      .nullable()
      .optional()
      .openapi({
        description:
          "A path to an image in the site's public folder, such as /images/jane.png, or an https URL.",
      }),
    url: optionalLinkSchema,
    x: optionalLinkSchema,
    linkedin: optionalLinkSchema,
    github: optionalLinkSchema,
    youtube: optionalLinkSchema,
    bluesky: optionalLinkSchema,
    mastodon: optionalLinkSchema,
    threads: optionalLinkSchema,
    instagram: optionalLinkSchema,
    previousId: siteAuthorIdSchema.optional().openapi({
      description:
        "Renames the author with this id to authorId, keeping its place in blog.json. Posts that name the old id lose the link until they name the new one.",
      example: "jane",
    }),
    force: z.boolean().optional().openapi({
      description:
        "Confirms renaming an author that is live or credited on Notra posts.",
    }),
  })
  .openapi("PutSiteAuthorRequest", {
    description:
      "The whole author: fields you leave out are removed. Links must be https URLs.",
    example: {
      name: "Jane Doe",
      title: "Head of Product",
      avatar: "/images/jane.png",
      x: "https://x.com/janedoe",
    },
  });

export const deleteSiteAuthorQuerySchema = z.object({
  force: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { in: "query", name: "force" },
      description:
        "Set to true to delete an author that is live or credited on Notra posts.",
    }),
});

export const patchSiteAuthorPageRequestSchema = z
  .object({
    layout: z.enum(SITE_AUTHOR_PAGE_LAYOUTS),
  })
  .openapi("PatchSiteAuthorPageRequest", { example: { layout: "stacked" } });

export const importSiteAuthorsRequestSchema = z
  .object({
    authorIds: z
      .array(resourceIdSchema("authorIds"))
      .min(1)
      .max(100)
      .optional()
      .openapi({
        description:
          "Notra author IDs from GET /v1/posts/authors. Omit to import every Notra author whose slug is not in blog.json yet.",
        example: ["auth_8f2kq1"],
      }),
    replace: z.boolean().optional().openapi({
      description:
        "Replace blog.json authors that already use an imported author's slug. Without it they are skipped.",
    }),
  })
  .openapi("ImportSiteAuthorsRequest");

export const importSiteAuthorsResponseSchema = siteAuthorsResponseSchema
  .extend({
    imported: z.array(z.string()).openapi({
      description: "Ids written to blog.json.",
      example: ["jane-doe"],
    }),
    avatarsSkipped: z.array(z.string()).openapi({
      description:
        "Ids whose avatar was a dashboard upload, which only the dashboard import can copy into the site. Set their avatar with PUT afterwards.",
    }),
  })
  .openapi("ImportSiteAuthorsResponse");

export const publishSiteRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(200).optional().openapi({
      description: "Commit message. Written from the changes when omitted.",
      example: "Add Jane Doe as an author",
    }),
  })
  .openapi("PublishSiteRequest");

export const publishSiteResponseSchema = z
  .object({
    published: z.boolean().openapi({
      description: "False when there was nothing to publish.",
    }),
    commitSha: z.string().nullable().openapi({
      description: "The commit that put the changes live.",
    }),
    deploymentQueued: z.boolean().openapi({
      description:
        "A production deployment of the commit was queued. False when it could not be queued yet; the site then deploys on its next push.",
    }),
  })
  .openapi("PublishSiteResponse");

const internalScopeSchema = z.object({
  organizationId: z.string().min(1),
});

const internalSiteScopeSchema = internalScopeSchema.extend({
  siteId: z.string().min(1),
  /** The Notra user behind the request; null for organization API keys. */
  actorUserId: z.string().min(1).nullable(),
});

export const internalSitesRequestSchema = z.discriminatedUnion("action", [
  internalScopeSchema.extend({ action: z.literal("listSites") }),
  internalSiteScopeSchema.extend({ action: z.literal("listAuthors") }),
  internalSiteScopeSchema.extend({
    action: z.literal("putAuthor"),
    authorId: siteAuthorIdSchema,
    author: putSiteAuthorRequestSchema,
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("deleteAuthor"),
    authorId: siteAuthorIdSchema,
    force: z.boolean(),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("setAuthorPage"),
    layout: z.enum(SITE_AUTHOR_PAGE_LAYOUTS),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("importAuthors"),
    authorIds: z.array(z.string().min(1)).optional(),
    replace: z.boolean(),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("publish"),
    message: z.string().optional(),
  }),
  internalScopeSchema.extend({
    action: z.literal("postAuthors"),
    postIds: z.array(z.string().min(1)).max(100),
  }),
]);

export const internalPostSiteAuthorsResponseSchema = z.object({
  posts: z.array(z.object({ postId: z.string(), siteId: z.string() })),
  sites: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      authors: z.array(siteAuthorSchema),
    })
  ),
});
