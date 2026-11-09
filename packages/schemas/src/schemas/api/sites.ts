import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  SITE_AUTHOR_AVATAR,
  SITE_AUTHOR_ID,
} from "@notra/sites-core/constants/site-config";
import { SITE_AUTHOR_PAGE_LAYOUTS } from "@notra/sites-core/constants/site-layout";
import {
  POST_PREVIEW_LIFETIMES,
  SITE_DEPLOYMENT_KINDS,
  SITE_DEPLOYMENT_STATUSES,
  SITE_DEPLOYMENT_TRIGGERS,
  SITE_DOMAIN_KINDS,
  SITE_DOMAIN_STATUSES,
  SITE_PREVIEW_VISIBILITIES,
  SITE_STATUSES,
} from "@notra/sites-core/constants/sites";
import { siteSectionsSchema } from "@notra/sites-core/schemas/site-sections";

import {
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
  SITE_AUTHOR_BIO_MAX_LENGTH,
} from "../../constants/dashboard/post-metadata";
import {
  SITE_API_DEPLOYMENTS_DEFAULT_LIMIT,
  SITE_API_DEPLOYMENTS_MAX_LIMIT,
} from "../../constants/sites-api";
import { siteAuthorLinkSchema } from "../shared/site-authors";
import { organizationResponseSchema } from "./content";
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

export const patchSiteSectionsRequestSchema = z
  .object({
    blog: z.string().optional().openapi({
      description: "Path of the blog, like /blog. Omit to turn the blog off.",
      example: "/blog",
    }),
    changelog: z.string().optional().openapi({
      description:
        "Path of the changelog, like /changelog. Omit to turn the changelog off.",
      example: "/changelog",
    }),
  })
  .superRefine((sections, ctx) => {
    const parsed = siteSectionsSchema.safeParse(sections);
    for (const issue of parsed.error?.issues ?? []) {
      ctx.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  })
  .openapi("PatchSiteSectionsRequest", {
    example: { blog: "/blog", changelog: "/changelog" },
  });

const siteMountsSchema = z.object({
  blog: z.string().optional(),
  changelog: z.string().optional(),
});

export const siteSectionsResponseSchema = z
  .object({
    site: z.object({ id: z.string(), name: z.string() }),
    sections: siteMountsSchema.openapi({
      description:
        "The sections blog.json sets with unpublished changes applied. They take over from the dashboard setting once a production build of them goes live.",
    }),
    liveSections: siteMountsSchema.openapi({
      description: "The paths the live site serves now.",
    }),
    hasUnpublishedChanges: z.boolean(),
  })
  .openapi("SiteSectionsResponse");

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
    action: z.literal("setSections"),
    sections: siteSectionsSchema,
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

const POST_PREVIEW_LIFETIME_KEYS = Object.keys(POST_PREVIEW_LIFETIMES) as [
  keyof typeof POST_PREVIEW_LIFETIMES,
  ...(keyof typeof POST_PREVIEW_LIFETIMES)[],
];

function pathParam(name: string, example: string) {
  return resourceIdSchema(name).openapi({
    param: { in: "path", name },
    example,
  });
}

export const siteDeploymentParamsSchema = siteParamsSchema.extend({
  deploymentId: pathParam("deploymentId", "dep_123"),
});

export const sitePostParamsSchema = siteParamsSchema.extend({
  postId: pathParam("postId", "post_123"),
});

export const listSiteDeploymentsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SITE_API_DEPLOYMENTS_MAX_LIMIT)
    .default(SITE_API_DEPLOYMENTS_DEFAULT_LIMIT)
    .openapi({
      description:
        "Newest deployments to return. Live deployments are always included.",
    }),
});

export const createSitePostPreviewBodySchema = z.object({
  postId: resourceIdSchema("postId").openapi({ example: "post_123" }),
  lifetime: z.enum(POST_PREVIEW_LIFETIME_KEYS).default("1d").openapi({
    description: "How long the preview stays open.",
  }),
  password: z.string().min(8).max(128).optional().openapi({
    description:
      "Lets people outside the workspace open the preview with this password.",
  }),
});

export const publishSitePostBodySchema = z.object({
  postId: resourceIdSchema("postId").openapi({ example: "post_123" }),
});

const siteRepositorySchema = z
  .object({ id: z.string().nullable(), owner: z.string(), name: z.string() })
  .nullable();

const siteSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    slug: z.string(),
    status: z.enum(SITE_STATUSES),
    suspendedReason: z.string().nullable(),
    repository: siteRepositorySchema,
    productionBranch: z.string(),
    rootDirectory: z.string().openapi({
      description: "Directory in the repository that holds blog.json.",
    }),
    liveUrl: z.string().openapi({
      description: "Public URL of the Site's first section.",
      example: "https://example.com/blog",
    }),
    publicOrigin: z.string(),
    aliasOrigin: z.string().openapi({
      description: "Notra-hosted address that always serves the Site.",
    }),
    mounts: z.object({
      blog: z.string().optional(),
      changelog: z.string().optional(),
    }),
    mountsFromConfig: z.boolean().openapi({
      description:
        "True when the live build's blog.json sets the sections, so the dashboard can't change them. Change them with PATCH /v1/sites/{siteId}/sections or in blog.json.",
    }),
    previewsEnabled: z.boolean(),
    previewVisibility: z.enum(SITE_PREVIEW_VISIBILITIES),
    smartDeployments: z.boolean(),
    analyticsEnabled: z.boolean(),
    liveDeploymentId: z.string().nullable(),
    rollbackActive: z.boolean().openapi({
      description:
        "Production is pinned to an older build; new builds finish but don't go live until someone promotes one in the dashboard.",
    }),
    liveSince: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("SiteDetail");

const siteDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  file: z.string().nullable(),
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  code: z.string(),
  message: z.string(),
});

const siteDeploymentSchema = z
  .object({
    id: z.string(),
    kind: z.enum(SITE_DEPLOYMENT_KINDS),
    previewKey: z.string().nullable(),
    trigger: z.enum(SITE_DEPLOYMENT_TRIGGERS),
    status: z.enum(SITE_DEPLOYMENT_STATUSES).openapi({
      description:
        "queued, building and uploading are in progress; ready, superseded, skipped, failed, canceled and expired are final.",
    }),
    live: z.boolean(),
    liveSince: z.string().nullable(),
    branch: z.string(),
    commitSha: z.string(),
    commitMessage: z.string().nullable(),
    commitAuthor: z.string().nullable(),
    pullRequestNumber: z.number().int().nullable(),
    url: z.string(),
    fileCount: z.number().int().nullable(),
    totalBytes: z.number().int().nullable(),
    buildDurationMs: z.number().int().nullable(),
    errorMessage: z.string().nullable(),
    skipReason: z.string().nullable(),
    diagnostics: z.array(siteDiagnosticSchema).openapi({
      description: "Compiler errors and warnings with file and line.",
    }),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
  })
  .openapi("SiteDeployment");

const siteDomainSchema = z
  .object({
    id: z.string(),
    hostname: z.string(),
    kind: z.enum(SITE_DOMAIN_KINDS),
    status: z.enum(SITE_DOMAIN_STATUSES),
    isPrimary: z.boolean(),
    records: z.array(
      z.object({
        type: z.enum(["CNAME", "TXT", "A"]),
        name: z.string(),
        value: z.string(),
        purpose: z.enum(["routing", "ownership", "certificate"]),
      })
    ),
    lastError: z.string().nullable(),
    verifiedAt: z.string().nullable(),
  })
  .openapi("SiteDomain");

const sitePreviewSchema = z
  .object({
    previewKey: z.string(),
    deploymentId: z.string(),
    visibility: z.enum(SITE_PREVIEW_VISIBILITIES),
    url: z.string(),
    branch: z.string().nullable(),
    pullRequestNumber: z.number().int().nullable(),
    commitSha: z.string().nullable(),
    activatedAt: z.string(),
  })
  .openapi("SitePreview");

const sitePostPreviewSchema = z
  .object({
    status: z.string().openapi({
      description: "Status of the preview's latest build.",
    }),
    live: z.boolean(),
    deleting: z.boolean(),
    errorMessage: z.string().nullable(),
    expiresAt: z.string(),
    hasPassword: z.boolean(),
    url: z.string(),
  })
  .openapi("SitePostPreview");

export const siteDetailDataSchema = z.object({
  site: siteSchema,
  domains: z.array(siteDomainSchema),
  previews: z.array(sitePreviewSchema),
});

export const siteDeploymentsDataSchema = z.object({
  deployments: z.array(siteDeploymentSchema),
});

export const siteDeploymentDataSchema = z.object({
  deployment: siteDeploymentSchema,
  log: z.string().nullable().openapi({
    description: "Newest build log output, trimmed at the start when long.",
  }),
  logTruncated: z.boolean(),
});

export const siteDeploymentStartDataSchema = z.object({
  deployment: siteDeploymentSchema,
});

export const sitePostPreviewDataSchema = z.object({
  // A union keeps the registered component itself non-nullable.
  preview: z.union([sitePostPreviewSchema, z.null()]).openapi({
    description: "Null when the post has no preview on this Site.",
  }),
});

export const sitePostPublicationDataSchema = z.object({
  operation: z.enum(["created", "updated"]),
  branchName: z.string(),
  path: z.string(),
  pullRequestNumber: z.number().int(),
  pullRequestUrl: z.string(),
});

const withOrganization = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  name: string
) => schema.extend({ organization: organizationResponseSchema }).openapi(name);

export const getSiteResponseSchema = withOrganization(
  siteDetailDataSchema,
  "GetSiteResponse"
);
export const listSiteDeploymentsResponseSchema = withOrganization(
  siteDeploymentsDataSchema,
  "ListSiteDeploymentsResponse"
);
export const getSiteDeploymentResponseSchema = withOrganization(
  siteDeploymentDataSchema,
  "GetSiteDeploymentResponse"
);
export const startSiteDeploymentResponseSchema = withOrganization(
  siteDeploymentStartDataSchema,
  "StartSiteDeploymentResponse"
);
export const sitePostPreviewResponseSchema = withOrganization(
  sitePostPreviewDataSchema,
  "SitePostPreviewResponse"
);
export const publishSitePostResponseSchema = withOrganization(
  sitePostPublicationDataSchema,
  "PublishSitePostResponse"
);

/** Payload the public API sends to the dashboard's internal Sites route. */
export const internalSiteApiRequestSchema = z.discriminatedUnion("action", [
  internalSiteScopeSchema.extend({ action: z.literal("get") }),
  internalSiteScopeSchema.extend({
    action: z.literal("listDeployments"),
    limit: z.number().int().min(1).max(SITE_API_DEPLOYMENTS_MAX_LIMIT),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("getDeployment"),
    deploymentId: z.string().min(1),
  }),
  internalSiteScopeSchema.extend({ action: z.literal("deployLatest") }),
  internalSiteScopeSchema.extend({
    action: z.literal("redeploy"),
    deploymentId: z.string().min(1),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("previewPost"),
    postId: z.string().min(1),
    lifetime: z.enum(POST_PREVIEW_LIFETIME_KEYS),
    password: z.string().min(8).max(128).optional(),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("postPreviewStatus"),
    postId: z.string().min(1),
  }),
  internalSiteScopeSchema.extend({
    action: z.literal("publishPost"),
    postId: z.string().min(1),
  }),
]);
