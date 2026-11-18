import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  postScheduleViewSchema,
  scheduledPublicationViewSchema,
} from "@notra/ai/schemas/post-schedules";
import { isValidTimezone } from "@notra/ai/utils/current-date";

import { CONTENT_CALENDAR_TIME_ZONE_MAX_LENGTH } from "../../constants/dashboard/content-calendar";
import { organizationResponseSchema } from "./content";
import { resourceIdSchema } from "./ids";

const scheduleDestinationRequestSchema = z
  .discriminatedUnion("destination", [
    z.object({
      destination: z.literal("github"),
      repositoryId: resourceIdSchema("repositoryId").openapi({
        description:
          "GitHub integration ID from GET /v1/integrations. Only for blog posts and changelogs.",
        example: "int_123",
      }),
      merge: z.boolean().default(true).openapi({
        description:
          "Merge the pull request at the scheduled time. When false, the pull request is only opened or updated.",
      }),
    }),
    z.object({
      destination: z.literal("social"),
      accountId: resourceIdSchema("accountId").openapi({
        description:
          "Connected X or LinkedIn account ID. Only for tweets and LinkedIn posts, on an account of the matching platform.",
        example: "acc_123",
      }),
    }),
  ])
  .openapi("ScheduleDestination");

export const schedulePostRequestSchema = z
  .object({
    scheduledAt: z.iso.datetime({ offset: true }).openapi({
      description:
        "When to publish, as an ISO 8601 timestamp. At most one year ahead; a time up to five minutes in the past publishes right away.",
      example: "2026-10-06T08:00:00Z",
    }),
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(CONTENT_CALENDAR_TIME_ZONE_MAX_LENGTH)
      .refine(isValidTimezone, "Unknown time zone")
      .default("UTC")
      .openapi({
        description:
          "IANA time zone the schedule was picked in. Used for display and emails only.",
        example: "Europe/Berlin",
      }),
    destinations: z
      .array(scheduleDestinationRequestSchema)
      .max(2)
      .refine(
        (destinations) =>
          new Set(destinations.map((item) => item.destination)).size ===
          destinations.length,
        "Each destination can only be added once"
      )
      .default([])
      .openapi({
        description:
          "Where the post goes out besides Notra. The post is always marked as published in Notra at the scheduled time.",
      }),
  })
  .openapi("SchedulePostRequest");

const postScheduleSchema = postScheduleViewSchema
  .extend({
    postId: postScheduleViewSchema.shape.postId.openapi({
      description: "ID of the scheduled post.",
    }),
    scheduledAt: postScheduleViewSchema.shape.scheduledAt.openapi({
      description: "When the post publishes (ISO 8601, UTC).",
    }),
    timeZone: postScheduleViewSchema.shape.timeZone.openapi({
      description:
        "IANA time zone the schedule was picked in, for display only.",
    }),
    publications: z
      .array(
        scheduledPublicationViewSchema
          .extend({
            id: scheduledPublicationViewSchema.shape.id.openapi({
              description: "ID of this destination's publication.",
            }),
            config: scheduledPublicationViewSchema.shape.config.openapi({
              description:
                "Settings for the destination, which are the GitHub integration and merge choice or the social account, and none for notra.",
            }),
            scheduledAt:
              scheduledPublicationViewSchema.shape.scheduledAt.openapi({
                description:
                  "When this destination publishes as an ISO 8601 UTC timestamp, which matches the schedule's scheduledAt.",
              }),
            timeZone: scheduledPublicationViewSchema.shape.timeZone.openapi({
              description:
                "IANA time zone the schedule was picked in, for display only.",
            }),
            destination:
              scheduledPublicationViewSchema.shape.destination.openapi({
                description:
                  "notra marks the post as published in Notra; github opens or merges a pull request; social posts to a connected X or LinkedIn account.",
              }),
            attempts: scheduledPublicationViewSchema.shape.attempts.openapi({
              description:
                "Publishing attempts started for this destination, including automatic retries.",
            }),
            errorCode: scheduledPublicationViewSchema.shape.errorCode.openapi({
              description:
                "Machine-readable code of the last failed attempt, such as github_publish_failed or too_many_attempts. Cleared when the destination publishes.",
            }),
            lastError: scheduledPublicationViewSchema.shape.lastError.openapi({
              description:
                "Message of the last failed attempt. Cleared when the destination publishes.",
            }),
            publishedAt:
              scheduledPublicationViewSchema.shape.publishedAt.openapi({
                description:
                  "When this destination published. Null until then.",
              }),
          })
          .openapi("ScheduledPublication")
      )
      .openapi({
        description: "One entry per destination of the schedule.",
      }),
  })
  .openapi("PostSchedule")
  .openapi({
    description: "When a post publishes and where it goes out.",
  });

export const postScheduleResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    schedule: z.union([postScheduleSchema, z.null()]).openapi({
      description:
        "The post's latest schedule with destinations that were not canceled, listing only those destinations. It stays after they published or failed, and destinations that already published remain after a cancel. Null when the post was never scheduled or all its destinations were canceled.",
    }),
  })
  .openapi("PostScheduleResponse")
  .openapi({ description: "The post's current schedule, if any." });

export const cancelPostScheduleResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    canceled: z.number().int().openapi({
      description: "Destinations that were canceled or cleared.",
    }),
    inProgress: z.boolean().openapi({
      description:
        "True when a destination was already publishing; it cannot be stopped and finishes on its own.",
    }),
  })
  .openapi("CancelPostScheduleResponse")
  .openapi({ description: "Result of canceling the post's schedule." });
