import { createRoute } from "@hono/zod-openapi";
import { posts } from "@notra/db/schema";
import { loadPostAgentReach } from "@notra/geo-core/geo/post-agent-reach";
import { geoWindow } from "@notra/geo-core/geo/window";
import { getPostParamsSchema } from "@notra/schemas/api/content";
import {
  postAgentReachQuerySchema,
  postAgentReachResponseSchema,
} from "@notra/schemas/api/post-agent-reach";
import { and, eq } from "drizzle-orm";

import { GEO_COMMON_ERROR_RESPONSES } from "../constants/geo-openapi";
import { runGeoEffect } from "../runtime/geo";
import { geoErrorResponse } from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse } from "../utils/openapi-responses";
import { resolveRequestOrganization } from "../utils/organizations";

export const postAgentReachRoutes = createOpenApiApp();

const getPostAgentReachRoute = createRoute({
  method: "get",
  path: "/posts/{postId}/agent-reach",
  tags: ["Content"],
  operationId: "getPostAgentReach",
  summary: "Get a post's agent reach",
  description:
    "Returns AI crawler, citation and referral visits to the post's live page on its Notra Site, including its Markdown copy. Defaults to the last 30 days. agentReach is null when the post isn't live on a Site.",
  request: { params: getPostParamsSchema, query: postAgentReachQuerySchema },
  responses: {
    200: {
      description: "Agent reach fetched successfully",
      content: {
        "application/json": { schema: postAgentReachResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    404: errorResponse("Organization or post not found"),
  },
});

postAgentReachRoutes.openapi(getPostAgentReachRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;
  const { postId } = c.req.valid("param");
  const post = await c.get("db").query.posts.findFirst({
    columns: { id: true },
    where: and(eq(posts.id, postId), eq(posts.organizationId, orgId)),
  });
  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }
  const outcome = await runGeoEffect(
    "postAgentReach",
    loadPostAgentReach(orgId, postId, geoWindow(c.req.valid("query")))
  );
  if (!outcome.ok) {
    return geoErrorResponse(c, outcome.failure);
  }
  return c.json({ organization, agentReach: outcome.value }, 200);
});
