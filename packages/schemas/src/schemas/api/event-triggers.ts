import "zod/compile";
import { z } from "@hono/zod-openapi";
import { SUPPORTED_CONTENT_GENERATION_TYPES } from "@notra/content-generation/schemas";

import { splitCommaSeparatedValues } from "../../utils/query-params";
import {
  automationNotifySchema,
  eventTriggerSourceConfigSchema as sharedEventTriggerSourceConfigSchema,
} from "../shared/automation";
import { organizationResponseSchema } from "./content";
import { resourceIdSchema } from "./ids";

export const eventTriggerParamsSchema = z.object({
  triggerId: resourceIdSchema("triggerId").openapi({
    param: {
      in: "path",
      name: "triggerId",
    },
    example: "trig_123",
  }),
});

export const getEventTriggersQuerySchema = z.object({
  repositoryIds: z
    .string()
    .optional()
    .transform((value) => splitCommaSeparatedValues(value))
    .openapi({
      description: "Filter by repository IDs using a comma-separated list",
      example: "repo_123,repo_456",
    }),
});

const sharedSourceConfigShape = sharedEventTriggerSourceConfigSchema.shape;

export const eventTriggerSourceConfigSchema =
  sharedEventTriggerSourceConfigSchema.extend({
    eventTypes: sharedSourceConfigShape.eventTypes.openapi({
      description:
        "GitHub webhook events that start a run: published releases, pushes, or both.",
    }),
    includePreReleases: sharedSourceConfigShape.includePreReleases.openapi({
      description:
        "Whether releases marked as pre-releases on GitHub also start a run.",
    }),
    ignoreCommitPatterns: sharedSourceConfigShape.ignoreCommitPatterns.openapi({
      description:
        "Case-insensitive JavaScript regular expressions tested against each commit message of a push, matching anywhere unless anchored. A push is skipped only when every commit matches at least one pattern. Releases are not filtered.",
      example: ["^chore(\\(|:)", "\\[skip ci\\]"],
    }),
  });

export const eventTriggerTargetsSchema = z.object({
  repositoryIds: z.array(z.string().trim().min(1)).min(1).openapi({
    description:
      "GitHub integration IDs whose webhook events start the trigger, as returned in the github array of GET /v1/integrations.",
  }),
});

export const eventTriggerOutputConfigSchema = z
  .object({
    publishDestination: z
      .enum(["webflow", "framer", "custom"])
      .optional()
      .openapi({
        description:
          "Deprecated and ignored. Auto-published posts are only marked as published in Notra; publish to GitHub or a Notra site from the post instead.",
        deprecated: true,
      }),
    brandVoiceId: z.string().trim().min(1).optional().openapi({
      description:
        "Brand identity ID to write in. Falls back to the organization's default brand identity when unset or not found.",
    }),
    notify: automationNotifySchema.optional().openapi({
      description:
        "Where to announce new content after a successful run: Slack posts to the organization's notification channel, email goes to the workspace owners.",
    }),
  })
  .optional();

export const createEventTriggerRequestSchema = z.object({
  sourceType: z.literal("github_webhook"),
  sourceConfig: eventTriggerSourceConfigSchema,
  targets: eventTriggerTargetsSchema,
  outputType: z.enum(SUPPORTED_CONTENT_GENERATION_TYPES),
  outputConfig: eventTriggerOutputConfigSchema,
  enabled: z.boolean(),
  autoPublish: z.boolean().default(false).openapi({
    description:
      "Save generated changelogs and blog posts with status published instead of draft. This only marks them published in Notra; nothing is pushed to GitHub or a Notra site. Other output types always stay drafts.",
  }),
});

export const patchEventTriggerRequestSchema =
  createEventTriggerRequestSchema.openapi("PatchEventTriggerRequest");

const eventTriggerSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().openapi({
    description:
      'Event triggers cannot be named through the API or the dashboard, so this is the default "Untitled Schedule".',
    example: "Untitled Schedule",
  }),
  sourceType: z.literal("github_webhook"),
  sourceConfig: eventTriggerSourceConfigSchema,
  targets: eventTriggerTargetsSchema,
  outputType: z.enum(SUPPORTED_CONTENT_GENERATION_TYPES),
  outputConfig: eventTriggerOutputConfigSchema.nullable().optional(),
  enabled: z.boolean().openapi({
    description:
      "Whether matching GitHub events start runs. Disabled triggers are stored but ignored.",
  }),
  autoPublish: z.boolean().openapi({
    description:
      "Save generated changelogs and blog posts with status published instead of draft. This only marks them published in Notra; nothing is pushed to GitHub or a Notra site. Other output types always stay drafts.",
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getEventTriggersResponseSchema = z.object({
  eventTriggers: z.array(eventTriggerSchema).openapi({
    description: "Event triggers, newest first.",
  }),
  repositoryMap: z.record(z.string(), z.string()).openapi({
    description:
      "Maps each targeted GitHub integration ID to an owner/repo label, followed by the default branch when one is known. Integrations without an owner and repo are left out.",
  }),
  organization: organizationResponseSchema,
});

export const eventTriggerResponseSchema = z.object({
  eventTrigger: eventTriggerSchema,
  organization: organizationResponseSchema,
});

export const deleteEventTriggerResponseSchema = z.object({
  id: z.string(),
  organization: organizationResponseSchema,
});
