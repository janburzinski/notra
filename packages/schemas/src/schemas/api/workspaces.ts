import "zod/compile";
import { z } from "@hono/zod-openapi";

import { organizationResponseSchema } from "./content";

const workspaceMembershipSchema = organizationResponseSchema.extend({
  role: z.string().nullable().openapi({
    description:
      "Your role in the workspace, or the invited role for pending invitations. Null for single-organization API keys or when the role is unknown.",
  }),
  status: z.enum(["active", "pending"]).openapi({
    description:
      "active for accepted memberships, pending for invitations not yet accepted.",
  }),
  isCurrent: z.boolean().openapi({
    description: "The workspace this request acts on.",
  }),
});

const workspaceAuthenticationSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("apiKey").openapi({
        description: "The request was authenticated with an API key.",
      }),
    }),
    z.object({
      type: z.literal("oauth").openapi({
        description:
          "The request was authenticated with an OAuth access token.",
      }),
      accountId: z.string().openapi({
        description: "Notra user ID of the signed-in account.",
      }),
      scopes: z.array(z.string()).openapi({
        description: "OAuth scopes granted to the token.",
      }),
    }),
  ])
  .openapi({ description: "How the request was authenticated." });

export const getWorkspacesQuerySchema = z.object({
  includePending: z.literal("true").optional().openapi({
    description:
      "Send true to also list pending workspace invitations. Only applies to OAuth tokens and account API keys.",
  }),
});

export const getWorkspacesResponseSchema = z
  .object({
    currentWorkspace: organizationResponseSchema,
    workspaces: z.array(workspaceMembershipSchema).openapi({
      description:
        "Current workspace first, then active memberships, then pending invitations, each sorted by name. Single-organization API keys only see the current workspace.",
    }),
    authentication: workspaceAuthenticationSchema,
  })
  .openapi("GetWorkspacesResponse")
  .openapi({
    description:
      "The workspaces the caller can act on and how the request was authenticated.",
  });
