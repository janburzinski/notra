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
    id: z.string().openapi({
      description: "The Site's ID, used as siteId in /v1/sites/{siteId}.",
      example: "site_8f2kq1",
    }),
    name: z.string().openapi({
      description: "Display name of the Site.",
      example: "Acme",
    }),
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

export const listSitesResponseSchema = z
  .object({
    sites: z.array(siteSummarySchema).openapi({
      description: "Use a Site's id as siteId in /v1/sites/{siteId}.",
    }),
  })
  .openapi({ description: "Every Notra Site in the workspace." });

const siteAuthorLinksSchema = z.object({
  url: z.string().nullable().openapi({
    description:
      "The author's personal website as an https URL, or null when not set.",
    example: "https://janedoe.dev",
  }),
  x: z.string().nullable().openapi({
    description: "The author's X profile URL, or null when not set.",
    example: "https://x.com/janedoe",
  }),
  linkedin: z.string().nullable().openapi({
    description: "The author's LinkedIn profile URL, or null when not set.",
  }),
  github: z.string().nullable().openapi({
    description: "The author's GitHub profile URL, or null when not set.",
  }),
  youtube: z.string().nullable().openapi({
    description: "The author's YouTube channel URL, or null when not set.",
  }),
  bluesky: z.string().nullable().openapi({
    description: "The author's Bluesky profile URL, or null when not set.",
  }),
  mastodon: z.string().nullable().openapi({
    description: "The author's Mastodon profile URL, or null when not set.",
  }),
  threads: z.string().nullable().openapi({
    description: "The author's Threads profile URL, or null when not set.",
  }),
  instagram: z.string().nullable().openapi({
    description: "The author's Instagram profile URL, or null when not set.",
  }),
});

const siteAuthorSchema = z
  .object({
    id: z.string().openapi({
      description:
        "The author's id in blog.json. Posts name the author with it and its author page lives at {blogMount}/author/{id}.",
      example: "jane-doe",
    }),
    ref: z.string().openapi({
      description:
        "Pass this in metadata.authorIds of PATCH /v1/posts/{postId} to credit the author on a blog post that publishes to this site.",
      example: "site:jane-doe",
    }),
    name: z.string().openapi({
      description: "The author's display name.",
      example: "Jane Doe",
    }),
    title: z.string().nullable().openapi({
      description: "The author's role or job title, or null when not set.",
      example: "Head of Product",
    }),
    bio: z.string().nullable().openapi({
      description:
        "Short biography shown on the author page, or null when not set.",
    }),
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

const siteRefSchema = z
  .object({
    id: z.string().openapi({ description: "The Site's ID." }),
    name: z.string().openapi({ description: "Display name of the Site." }),
  })
  .openapi({ description: "The Site the request applied to." });

export const siteAuthorsResponseSchema = z
  .object({
    site: siteRefSchema,
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
  .openapi("SiteAuthors", {
    description:
      "The Site's authors and author page layout in blog.json after the request, including unpublished changes.",
  });

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
  blog: z.string().optional().openapi({
    description:
      "Path the blog is served under, or absent when the blog is off.",
    example: "/blog",
  }),
  changelog: z.string().optional().openapi({
    description:
      "Path the changelog is served under, or absent when the changelog is off.",
    example: "/changelog",
  }),
});

export const siteSectionsResponseSchema = z
  .object({
    site: siteRefSchema,
    sections: siteMountsSchema.openapi({
      description:
        "The sections blog.json sets with unpublished changes applied. They take over from the dashboard setting once a production build of them goes live.",
    }),
    liveSections: siteMountsSchema.openapi({
      description: "The paths the live site serves now.",
    }),
    hasUnpublishedChanges: z.boolean().openapi({
      description:
        "blog.json has staged Design changes that are not live yet. Publish them with POST /v1/sites/{siteId}/publish or from the dashboard.",
    }),
  })
  .openapi("SiteSectionsResponse", {
    description:
      "The Site's blog and changelog paths after the update, next to the paths live now.",
  });

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
  .openapi("ImportSiteAuthorsResponse", {
    description:
      "The Site's authors after the import, with the ids that were written and those whose avatar was skipped.",
  });

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
  .openapi("PublishSiteResponse", {
    description:
      "Whether the Site's unpublished blog.json changes were committed and a production deployment queued.",
  });

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
  .object({
    id: z.string().nullable().openapi({
      description: "GitHub's ID for the repository.",
    }),
    owner: z.string().openapi({
      description: "GitHub user or organization that owns the repository.",
    }),
    name: z.string().openapi({ description: "Repository name." }),
  })
  .nullable();

const siteSchema = z
  .object({
    id: z.string().openapi({ description: "The Site's ID." }),
    projectId: z.string().openapi({
      description:
        "Notra project the Site belongs to. Use it as projectId in /v1/projects/{projectId}.",
    }),
    name: z.string().openapi({ description: "Display name of the Site." }),
    slug: z.string().openapi({
      description: "Used in the Site's Notra-hosted addresses.",
    }),
    status: z.enum(SITE_STATUSES).openapi({
      description: "suspended while the Site is paused.",
    }),
    suspendedReason: z.string().nullable().openapi({
      description:
        "Why the Site is suspended. Null while active or when no reason was given.",
    }),
    repository: siteRepositorySchema.openapi({
      description:
        "GitHub repository the Site builds from, or null when none is connected.",
    }),
    productionBranch: z.string().openapi({
      description: "Branch that production deployments build from.",
    }),
    rootDirectory: z.string().openapi({
      description: "Directory in the repository that holds blog.json.",
    }),
    liveUrl: z.string().openapi({
      description: "Public URL of the Site's first section.",
      example: "https://example.com/blog",
    }),
    publicOrigin: z.string().openapi({
      description:
        "Origin the Site is served from: the primary custom domain, or the Notra-hosted address when there is none.",
    }),
    aliasOrigin: z.string().openapi({
      description: "Notra-hosted address that always serves the Site.",
    }),
    mounts: siteMountsSchema.openapi({
      description:
        "Paths the blog and changelog are served under. A missing key means that section is off.",
    }),
    mountsFromConfig: z.boolean().openapi({
      description:
        "True when the live build's blog.json sets the sections, so the dashboard can't change them. Change them with PATCH /v1/sites/{siteId}/sections or in blog.json.",
    }),
    previewsEnabled: z.boolean().openapi({
      description: "Whether preview deployments are built and served.",
    }),
    previewVisibility: z.enum(SITE_PREVIEW_VISIBILITIES).openapi({
      description:
        "public previews open for anyone; protected previews need a workspace sign-in or the preview's password.",
    }),
    smartDeployments: z.boolean().openapi({
      description:
        "Pushes and pull requests whose site inputs are unchanged from an existing build are not rebuilt; their deployments end as skipped.",
    }),
    analyticsEnabled: z.boolean().openapi({
      description:
        "Whether the live production site serves Notra's cookieless notra.js script and counts visitors and AI agent visits into the project's AI traffic and web analytics. On by default; previews are never counted.",
    }),
    liveDeploymentId: z.string().nullable().openapi({
      description:
        "Production deployment serving visitors now, or null when nothing is live.",
    }),
    rollbackActive: z.boolean().openapi({
      description:
        "Production is pinned to an older build; new builds finish but don't go live until someone promotes one in the dashboard.",
    }),
    liveSince: z.string().nullable().openapi({
      description: "When the live production deployment started serving.",
    }),
    createdAt: z.string().openapi({
      description: "When the Site was created, as an ISO 8601 timestamp.",
    }),
  })
  .openapi("SiteDetail", { description: "The Site and its settings." });

const siteDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]).openapi({
    description:
      "error fails the build; warning is reported but the build continues.",
  }),
  file: z.string().nullable().openapi({
    description: "File the diagnostic points at, or null when it has none.",
  }),
  line: z.number().int().optional().openapi({
    description:
      "Line in the file, counted from 1, or absent when the diagnostic has no position.",
  }),
  column: z.number().int().optional().openapi({
    description:
      "Column in the line, counted from 1, or absent when the diagnostic has no position.",
  }),
  code: z.string().openapi({
    description: "Machine-readable diagnostic kind.",
    example: "mdx_syntax",
  }),
  message: z.string().openapi({ description: "Human-readable explanation." }),
});

const siteDeploymentSchema = z
  .object({
    id: z.string().openapi({
      description:
        "The deployment's ID, used as deploymentId in deployment routes.",
    }),
    kind: z.enum(SITE_DEPLOYMENT_KINDS).openapi({
      description:
        "production builds the production branch for visitors; preview builds a branch, pull request or post preview.",
    }),
    previewKey: z.string().nullable().openapi({
      description:
        "Preview the deployment builds, matching previewKey in a Site's previews. Null for production.",
    }),
    trigger: z.enum(SITE_DEPLOYMENT_TRIGGERS).openapi({
      description:
        "push and pull_request come from GitHub, manual from a deploy request, redeploy from a rebuild, config from a settings change, and toolchain from Notra rebuilding the live commit after a builder update.",
    }),
    status: z.enum(SITE_DEPLOYMENT_STATUSES).openapi({
      description:
        "queued, building and uploading are in progress; ready, superseded, skipped, failed, canceled and expired are final.",
    }),
    live: z.boolean().openapi({
      description: "The deployment is serving production or a preview now.",
    }),
    liveSince: z.string().nullable().openapi({
      description: "When it started serving. Null when not live.",
    }),
    branch: z.string().openapi({ description: "Git branch that was built." }),
    commitSha: z
      .string()
      .openapi({ description: "Git commit SHA that was built." }),
    commitMessage: z.string().nullable().openapi({
      description: "Message of the built commit, or null when unknown.",
    }),
    commitAuthor: z.string().nullable().openapi({
      description:
        "Name of the commit's author, or the GitHub login of the pull request author for pull request builds, or null when unknown.",
    }),
    pullRequestNumber: z.number().int().nullable().openapi({
      description:
        "GitHub pull request the deployment builds, or null when it isn't built from a pull request.",
    }),
    url: z.string().openapi({
      description: "Where the deployment serves its first section.",
    }),
    fileCount: z.number().int().nullable().openapi({
      description:
        "Files in the built output. Set when the build becomes ready; null for deployments that never finished a build, such as queued, skipped, failed or canceled ones.",
    }),
    totalBytes: z.number().int().nullable().openapi({
      description:
        "Total size of the built output in bytes. Null under the same conditions as fileCount.",
    }),
    buildDurationMs: z.number().int().nullable().openapi({
      description: "Build time in milliseconds.",
    }),
    errorMessage: z.string().nullable().openapi({
      description:
        "Why the build failed, or why it was canceled or superseded before building.",
    }),
    skipReason: z.string().nullable().openapi({
      description: "Why smart deployments skipped the build.",
    }),
    diagnostics: z.array(siteDiagnosticSchema).openapi({
      description: "Compiler errors and warnings with file and line.",
    }),
    createdAt: z.string().openapi({
      description: "When the deployment was queued, as an ISO 8601 timestamp.",
    }),
    startedAt: z.string().nullable().openapi({
      description:
        "When the build started, as an ISO 8601 timestamp, or null while queued or when it never ran.",
    }),
    finishedAt: z.string().nullable().openapi({
      description:
        "When the deployment reached a final status, as an ISO 8601 timestamp, or null while in progress.",
    }),
  })
  .openapi("SiteDeployment", {
    description: "A production or preview build of the Site.",
  });

const siteDomainSchema = z
  .object({
    id: z.string().openapi({ description: "The domain's ID." }),
    hostname: z.string().openapi({
      description: "The custom hostname, without scheme or path.",
      example: "blog.example.com",
    }),
    kind: z.enum(SITE_DOMAIN_KINDS).openapi({
      description:
        "subdomain points the hostname at Notra with DNS records and Notra issues its certificate; proxy keeps your existing website on the hostname, which forwards the Site's paths to Notra with rewrites.",
    }),
    status: z.enum(SITE_DOMAIN_STATUSES).openapi({
      description:
        "pending until the first check, verifying while checks have not passed yet, active once verified, failed when a domain that was active or failed fails a check. Domains that are not active are rechecked automatically.",
    }),
    isPrimary: z.boolean().openapi({
      description: "The domain is the Site's publicOrigin.",
    }),
    records: z
      .array(
        z.object({
          type: z.enum(["CNAME", "TXT", "A"]).openapi({
            description: "DNS record type.",
          }),
          name: z.string().openapi({ description: "Host name of the record." }),
          value: z
            .string()
            .openapi({ description: "Value the record must hold." }),
          purpose: z.enum(["routing", "ownership", "certificate"]).openapi({
            description:
              "routing points the hostname at Notra, ownership proves control of the domain, and certificate lets the TLS certificate be issued.",
          }),
        })
      )
      .openapi({ description: "DNS records to create for the domain." }),
    lastError: z.string().nullable().openapi({
      description:
        "What the latest check found missing, such as a DNS record, the ownership TXT record, the certificate or the proxy rewrites. Null after a passing check.",
    }),
    verifiedAt: z.string().nullable().openapi({
      description:
        "When the domain first verified. Kept if a later check fails; null until it verifies.",
    }),
  })
  .openapi("SiteDomain", {
    description: "A custom domain attached to the Site.",
  });

const sitePreviewSchema = z
  .object({
    previewKey: z.string().openapi({
      description:
        "Identifies the preview: one per branch, and one per post for post previews.",
    }),
    deploymentId: z.string().openapi({
      description: "Deployment serving the preview.",
    }),
    visibility: z.enum(SITE_PREVIEW_VISIBILITIES).openapi({
      description:
        "public previews open for anyone; protected previews need a workspace sign-in or the preview's password.",
    }),
    url: z.string().openapi({
      description: "Where the preview serves its first section.",
    }),
    branch: z.string().nullable().openapi({
      description: "Branch the preview was built from, or null when unknown.",
    }),
    pullRequestNumber: z.number().int().nullable().openapi({
      description:
        "GitHub pull request the preview builds, or null when it isn't from a pull request.",
    }),
    commitSha: z.string().nullable().openapi({
      description: "Commit the preview was built from, or null when unknown.",
    }),
    activatedAt: z.string().openapi({
      description: "When the deployment started serving the preview.",
    }),
  })
  .openapi("SitePreview", {
    description: "A preview deployment the Site is serving now.",
  });

const sitePostPreviewSchema = z
  .object({
    status: z.string().openapi({
      description: "Status of the preview's latest build.",
    }),
    live: z.boolean().openapi({
      description: "The preview is being served and has not expired.",
    }),
    deleting: z.boolean().openapi({
      description: "The preview is being removed.",
    }),
    errorMessage: z.string().nullable().openapi({
      description: "Why the latest build failed or stopped.",
    }),
    expiresAt: z.string().openapi({
      description: "When the preview stops being served.",
    }),
    hasPassword: z.boolean().openapi({
      description: "People outside the workspace can open it with a password.",
    }),
    url: z.string().openapi({
      description: "The post's page on the preview.",
    }),
  })
  .openapi("SitePostPreview");

export const siteDetailDataSchema = z.object({
  site: siteSchema,
  domains: z.array(siteDomainSchema).openapi({
    description:
      "Custom domains attached to the Site, or empty when it has none.",
  }),
  previews: z.array(sitePreviewSchema).openapi({
    description:
      "Previews that are being served now, or an empty list when there are none.",
  }),
});

export const siteDeploymentsDataSchema = z.object({
  deployments: z.array(siteDeploymentSchema).openapi({
    description: "The newest deployments, plus any that are live.",
  }),
});

export const siteDeploymentDataSchema = z.object({
  deployment: siteDeploymentSchema,
  log: z.string().nullable().openapi({
    description: "Newest build log output, trimmed at the start when long.",
  }),
  logTruncated: z.boolean().openapi({
    description: "The log was cut to its last 64,000 characters.",
  }),
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
  operation: z.enum(["created", "updated"]).openapi({
    description:
      "created when a new pull request was opened, updated when the post's open pull request was updated.",
  }),
  branchName: z.string().openapi({
    description: "Branch the pull request merges from.",
  }),
  path: z.string().openapi({
    description: "Path of the post's file in the repository.",
  }),
  pullRequestNumber: z.number().int().openapi({
    description: "Number of the publishing pull request on GitHub.",
  }),
  pullRequestUrl: z.string().openapi({
    description: "URL of the publishing pull request on GitHub.",
  }),
});

const withOrganization = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  name: string,
  description: string
) =>
  schema
    .extend({ organization: organizationResponseSchema })
    .openapi(name, { description });

export const getSiteResponseSchema = withOrganization(
  siteDetailDataSchema,
  "GetSiteResponse",
  "The Site with its settings, custom domains and live previews."
);
export const listSiteDeploymentsResponseSchema = withOrganization(
  siteDeploymentsDataSchema,
  "ListSiteDeploymentsResponse",
  "The Site's recent deployments."
);
export const getSiteDeploymentResponseSchema = withOrganization(
  siteDeploymentDataSchema,
  "GetSiteDeploymentResponse",
  "The deployment with its build log."
);
export const startSiteDeploymentResponseSchema = withOrganization(
  siteDeploymentStartDataSchema,
  "StartSiteDeploymentResponse",
  "The deployment that was queued."
);
export const sitePostPreviewResponseSchema = withOrganization(
  sitePostPreviewDataSchema,
  "SitePostPreviewResponse",
  "The post's private preview on the Site."
);
export const publishSitePostResponseSchema = withOrganization(
  sitePostPublicationDataSchema,
  "PublishSitePostResponse",
  "The pull request that publishes the post to the Site's repository."
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
