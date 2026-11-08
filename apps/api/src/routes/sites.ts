import { createRoute } from "@hono/zod-openapi";
import {
  deleteSiteAuthorQuerySchema,
  importSiteAuthorsRequestSchema,
  importSiteAuthorsResponseSchema,
  listSitesResponseSchema,
  patchSiteAuthorPageRequestSchema,
  publishSiteRequestSchema,
  publishSiteResponseSchema,
  putSiteAuthorRequestSchema,
  siteAuthorParamsSchema,
  siteAuthorsResponseSchema,
  siteParamsSchema,
} from "@notra/schemas/api/sites";

import { SITES_PUBLISH_TIMEOUT_MS } from "../constants/sites";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import { getOrganizationId } from "../utils/auth";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";
import { callSites, siteActorUserId, sitesErrorResponse } from "../utils/sites";

export const sitesRoutes = createOpenApiApp();

const SITES_TAG = "Content";

const commonErrors = {
  401: errorResponse("Missing or invalid API key"),
  403: errorResponse("Forbidden"),
  503: errorResponse("Notra Sites or authentication is unavailable"),
};

const siteErrors = {
  ...commonErrors,
  400: errorResponse("Invalid path params or request body"),
  404: errorResponse("Site or author not found"),
  409: errorResponse(
    "The site has no blog, blog.json can't be edited as it is, another editor changed it meanwhile, or the author is in use (code SITE_AUTHOR_IN_USE)"
  ),
  504: errorResponse("The site's repository didn't answer in time"),
};

const writeRateLimit = rateLimitResponse(
  RATE_LIMITS.siteUpdate.requests,
  RATE_LIMITS.siteUpdate.window,
  "API key"
);

const STAGED_NOTE =
  "Changes are saved as unpublished Design changes to the site's blog.json, the same draft the dashboard's Design tab shows, and go live when published with POST /v1/sites/{siteId}/publish or from the dashboard.";

const listSitesRoute = createRoute({
  method: "get",
  path: "/sites",
  tags: [SITES_TAG],
  operationId: "listSites",
  summary: "List Notra Sites",
  description:
    "Returns the organization's Notra Sites, oldest first. Sites with a blogMount have authors.",
  responses: {
    200: {
      description: "Sites fetched successfully",
      content: { "application/json": { schema: listSitesResponseSchema } },
    },
    ...siteErrors,
  },
});

const listSiteAuthorsRoute = createRoute({
  method: "get",
  path: "/sites/{siteId}/authors",
  tags: [SITES_TAG],
  operationId: "listSiteAuthors",
  summary: "List a site's authors",
  description:
    "Returns the authors in the site's blog.json, including unpublished Design changes, with how many Notra posts credit each one, plus the author page layout.",
  request: { params: siteParamsSchema },
  responses: {
    200: {
      description: "Authors fetched successfully",
      content: { "application/json": { schema: siteAuthorsResponseSchema } },
    },
    ...siteErrors,
  },
});

const putSiteAuthorRoute = createRoute({
  method: "put",
  path: "/sites/{siteId}/authors/{authorId}",
  tags: [SITES_TAG],
  operationId: "upsertSiteAuthor",
  summary: "Create or update a site author",
  description: `Creates the author or replaces all of its fields. Send previousId to rename an author; renaming one that is live or credited on Notra posts needs force: true, since those posts lose the link. ${STAGED_NOTE}`,
  request: {
    params: siteAuthorParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: putSiteAuthorRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Author saved as an unpublished change",
      content: { "application/json": { schema: siteAuthorsResponseSchema } },
    },
    ...siteErrors,
    429: writeRateLimit,
  },
});

const deleteSiteAuthorRoute = createRoute({
  method: "delete",
  path: "/sites/{siteId}/authors/{authorId}",
  tags: [SITES_TAG],
  operationId: "deleteSiteAuthor",
  summary: "Delete a site author",
  description: `Removes the author from blog.json. Deleting one that is live or credited on Notra posts needs force=true; those posts then show the id as a plain name. ${STAGED_NOTE}`,
  request: {
    params: siteAuthorParamsSchema,
    query: deleteSiteAuthorQuerySchema,
  },
  responses: {
    200: {
      description: "Author removed as an unpublished change",
      content: { "application/json": { schema: siteAuthorsResponseSchema } },
    },
    ...siteErrors,
    429: writeRateLimit,
  },
});

const importSiteAuthorsRoute = createRoute({
  method: "post",
  path: "/sites/{siteId}/authors/import",
  tags: [SITES_TAG],
  operationId: "importSiteAuthors",
  summary: "Import Notra authors into a site",
  description: `Copies Notra authors (GET /v1/posts/authors) into blog.json, using their slug as the id. Avatars on https URLs are kept; dashboard uploads are listed in avatarsSkipped. ${STAGED_NOTE}`,
  request: {
    params: siteParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: importSiteAuthorsRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Authors imported as unpublished changes",
      content: {
        "application/json": { schema: importSiteAuthorsResponseSchema },
      },
    },
    ...siteErrors,
    429: writeRateLimit,
  },
});

const patchSiteAuthorPageRoute = createRoute({
  method: "patch",
  path: "/sites/{siteId}/author-page",
  tags: [SITES_TAG],
  operationId: "updateSiteAuthorPage",
  summary: "Set the author page layout",
  description: `Sets blog.authorPage, the layout of every author page. ${STAGED_NOTE}`,
  request: {
    params: siteParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: patchSiteAuthorPageRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Layout saved as an unpublished change",
      content: { "application/json": { schema: siteAuthorsResponseSchema } },
    },
    ...siteErrors,
    429: writeRateLimit,
  },
});

const publishSiteRoute = createRoute({
  method: "post",
  path: "/sites/{siteId}/publish",
  tags: [SITES_TAG],
  operationId: "publishSite",
  summary: "Publish a site's Design changes",
  description:
    "Commits the unpublished blog.json changes, with the images they use, to the site's production branch and deploys it, like Publish in the dashboard. Returns 409 with code SITE_HAS_OTHER_CHANGES when other files have unpublished changes, so work staged in the dashboard is never published by accident; publish those from the dashboard.",
  request: {
    params: siteParamsSchema,
    body: {
      required: false,
      content: { "application/json": { schema: publishSiteRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Changes published",
      content: { "application/json": { schema: publishSiteResponseSchema } },
    },
    ...siteErrors,
    429: rateLimitResponse(
      RATE_LIMITS.sitePublish.requests,
      RATE_LIMITS.sitePublish.window
    ),
  },
});

sitesRoutes.openapi(listSitesRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        { action: "listSites", organizationId },
        listSitesResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(listSiteAuthorsRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "listAuthors",
          organizationId,
          siteId: c.req.valid("param").siteId,
          actorUserId: siteActorUserId(c),
        },
        siteAuthorsResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(putSiteAuthorRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  const rateLimited = await enforceRatelimit(c, ratelimit.siteUpdate);
  if (rateLimited) {
    return rateLimited;
  }
  const { siteId, authorId } = c.req.valid("param");
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "putAuthor",
          organizationId,
          siteId,
          actorUserId: siteActorUserId(c),
          authorId,
          author: c.req.valid("json"),
        },
        siteAuthorsResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(deleteSiteAuthorRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  const rateLimited = await enforceRatelimit(c, ratelimit.siteUpdate);
  if (rateLimited) {
    return rateLimited;
  }
  const { siteId, authorId } = c.req.valid("param");
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "deleteAuthor",
          organizationId,
          siteId,
          actorUserId: siteActorUserId(c),
          authorId,
          force: c.req.valid("query").force === "true",
        },
        siteAuthorsResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(importSiteAuthorsRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  const rateLimited = await enforceRatelimit(c, ratelimit.siteUpdate);
  if (rateLimited) {
    return rateLimited;
  }
  const { authorIds, replace } = c.req.valid("json");
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "importAuthors",
          organizationId,
          siteId: c.req.valid("param").siteId,
          actorUserId: siteActorUserId(c),
          authorIds,
          replace: replace ?? false,
        },
        importSiteAuthorsResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(patchSiteAuthorPageRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  const rateLimited = await enforceRatelimit(c, ratelimit.siteUpdate);
  if (rateLimited) {
    return rateLimited;
  }
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "setAuthorPage",
          organizationId,
          siteId: c.req.valid("param").siteId,
          actorUserId: siteActorUserId(c),
          layout: c.req.valid("json").layout,
        },
        siteAuthorsResponseSchema
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});

sitesRoutes.openapi(publishSiteRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }
  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.sitePublish,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = publishSiteRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
  try {
    return c.json(
      await callSites(
        c.env ?? {},
        {
          action: "publish",
          organizationId,
          siteId: c.req.valid("param").siteId,
          actorUserId: siteActorUserId(c),
          message: parsed.data.message,
        },
        publishSiteResponseSchema,
        SITES_PUBLISH_TIMEOUT_MS
      ),
      200
    );
  } catch (error) {
    return sitesErrorResponse(c, error);
  }
});
