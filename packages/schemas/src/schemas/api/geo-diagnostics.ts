import "zod/compile";
import { z } from "@hono/zod-openapi";
import { GEO_SHORT_FIELD_MAX_LENGTH } from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { projectParamsSchema } from "./geo-params";
import { geoSentimentWindowQuerySchema } from "./geo-visibility";

const sentimentBucketSchema = z.object({
  totalChecks: z.number().int().openapi({
    description:
      "Answers to tracked prompts in the project's prompt language. Sequence and persona answers are not counted.",
  }),
  mentions: z.number().int().openapi({
    description: "Answers that mentioned the tracked brand.",
  }),
  positive: z.number().int().openapi({
    description: "Mentions classified as positive.",
  }),
  neutral: z.number().int().openapi({
    description: "Mentions classified as neutral.",
  }),
  negative: z.number().int().openapi({
    description: "Mentions classified as negative.",
  }),
  lastCheckedAt: z.string().nullable().openapi({
    description: "Latest answer captured, or `null` when there are none.",
  }),
  score: z.number().nullable().openapi({
    description:
      "Sentiment score from 0 to 100: positive counts 100, neutral 50, negative 0, averaged over classified mentions. `null` without classified mentions.",
  }),
  classifiedMentions: z.number().int().openapi({
    description: "Mentions with a sentiment: positive + neutral + negative.",
  }),
  unknownMentions: z.number().int().openapi({
    description: "Mentions without a sentiment classification.",
  }),
  notMentioned: z.number().int().openapi({
    description: "Answers that did not mention the brand.",
  }),
  positiveShare: z.number().nullable().openapi({
    description:
      "Share of classified mentions that are positive, from 0 to 1. `null` without classified mentions.",
  }),
  neutralShare: z.number().nullable().openapi({
    description:
      "Share of classified mentions that are neutral, from 0 to 1. `null` without classified mentions.",
  }),
  negativeShare: z.number().nullable().openapi({
    description:
      "Share of classified mentions that are negative, from 0 to 1. `null` without classified mentions.",
  }),
  classificationCoverage: z.number().nullable().openapi({
    description:
      "Share of mentions that have a sentiment, from 0 to 1. `null` without mentions.",
  }),
});

const sentimentDayBucketSchema = sentimentBucketSchema.extend({
  day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
});

const periodSchema = z.object({
  from: z.string().openapi({
    description: "First day of the range in UTC, formatted as YYYY-MM-DD.",
  }),
  to: z.string().openapi({
    description: "Last day of the range in UTC, formatted as YYYY-MM-DD.",
  }),
});

export const geoSentimentResponseSchema = z
  .object({
    configured: z.literal(true).openapi({
      description: "Always `true` for a project-scoped request.",
    }),
    summary: sentimentBucketSchema.openapi({
      description: "Totals for the selected period.",
    }),
    engines: z
      .array(
        sentimentBucketSchema.extend({
          engine: z.string().openapi({
            description: "Answer engine id, as listed by listGeoEngines.",
          }),
        })
      )
      .openapi({
        description: "Totals per engine that answered in the selected period.",
      }),
    points: z.array(sentimentDayBucketSchema).openapi({
      description:
        "One point per UTC day of the selected period, including days without answers.",
    }),
    comparison: z
      .object({
        current: periodSchema.openapi({
          description: "Selected period as inclusive UTC days (YYYY-MM-DD).",
        }),
        previous: periodSchema.openapi({
          description:
            "Period of the same length right before it, as inclusive UTC days (YYYY-MM-DD).",
        }),
        summary: sentimentBucketSchema.openapi({
          description: "Totals for the previous period.",
        }),
        points: z.array(sentimentDayBucketSchema).openapi({
          description: "One point per UTC day of the previous period.",
        }),
        delta: z.number().nullable().openapi({
          description:
            "Current `score` minus previous `score`, in points. `null` when either period has no classified mentions.",
        }),
      })
      .optional()
      .openapi({
        description:
          "The selected period compared with the one before it. Always returned by this endpoint.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoSentimentResponse", {
    description:
      "How positively answers mention the brand, per engine and day, compared with the previous period.",
  });

export const geoSentimentEvidenceQuerySchema =
  geoSentimentWindowQuerySchema.extend({
    cursor: z.string().max(4096).optional(),
  });

export const geoSentimentEvidenceResponseSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().openapi({ description: "Check id of the answer." }),
          scanId: z
            .string()
            .openapi({ description: "Scan that captured the answer." }),
          promptId: z.string().openapi({
            description:
              "Prompt the answer belongs to: `custom-` plus the prompt id for custom prompts, the slug for auto prompts.",
          }),
          prompt: z.string().openapi({ description: "Prompt text." }),
          engine: z.string().openapi({
            description: "Answer engine id, as listed by listGeoEngines.",
          }),
          language: z.string().openapi({
            description:
              "Language the prompt was asked in, such as `English`. An empty string means English.",
          }),
          capturedAt: z.string().openapi({
            description: "ISO timestamp when the answer was captured.",
          }),
          answer: z.string().openapi({ description: "Full answer text." }),
          excerpt: z.string().openapi({
            description: "Part of the answer around the brand mention.",
          }),
        })
      )
      .openapi({
        description:
          "Answers to tracked prompts that mentioned the brand negatively, newest first, 25 per page.",
      }),
    nextCursor: z.string().nullable().openapi({
      description:
        "Pass as `cursor` with the same window to fetch the next page, or `null` on the last page.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoSentimentEvidenceResponse", {
    description: "A page of answers that mentioned the brand negatively.",
  });

const sentimentEvidenceSchema = z.object({
  checkId: z.string().openapi({
    description: "Id of the answer the quote comes from.",
  }),
  quote: z.string().openapi({
    description:
      "Quote from that answer. It matches the answer text except for whitespace, quote marks and dash style.",
  }),
  prompt: z
    .string()
    .openapi({ description: "Prompt the answer responded to." }),
  engine: z
    .string()
    .openapi({ description: "Answer engine id, as listed by listGeoEngines." }),
  capturedAt: z
    .string()
    .openapi({ description: "ISO timestamp when the answer was captured." }),
});

export const geoSentimentAnalysisResponseSchema = z
  .object({
    status: z
      .enum(["ready", "pending", "stale", "failed", "unavailable"])
      .openapi({
        description:
          "`ready` when the stored analysis matches the current answers, `pending` while an analysis runs, `stale` when it is missing or older than the current answers, `failed` when the last run failed, `unavailable` when the brand name or the cache is not set up. This endpoint only reads stored analyses and never starts one.",
      }),
    result: z
      .object({
        fingerprint: z.string().openapi({
          description: "Identifies the set of answers that was analyzed.",
        }),
        generatedAt: z.string().openapi({
          description: "ISO timestamp when the analysis was generated.",
        }),
        sampled: z.number().int().openapi({
          description:
            "Answers sent to the model, at most 12 positive and 12 negative.",
        }),
        eligible: z.number().int().openapi({
          description:
            "Positive or negative brand mentions in the period when the analysis ran.",
        }),
        themes: z
          .array(
            z.object({
              title: z.string().openapi({
                description: "The attribute praised or criticized.",
              }),
              polarity: z.enum(["positive", "negative"]).openapi({
                description:
                  "Whether answers praise or criticize this attribute.",
              }),
              claims: z
                .array(
                  z.object({
                    statement: z.string().openapi({
                      description:
                        "What the answers say about the brand, written by the model.",
                    }),
                    evidence: z.array(sentimentEvidenceSchema).openapi({
                      description:
                        "Quotes backing this claim, each checked against its answer text. Claims without a matching quote are dropped.",
                    }),
                  })
                )
                .openapi({
                  description:
                    "Claims under this theme, each with at least one verified quote.",
                }),
              evidence: z.array(sentimentEvidenceSchema).openapi({
                description:
                  "Every quote from the theme's claims in one list, in claim order, with repeated quotes from the same answer listed once.",
              }),
            })
          )
          .openapi({
            description:
              "Attributes the answers praise or criticize, each with supporting claims.",
          }),
      })
      .nullable()
      .openapi({
        description:
          "The latest analysis. With `pending`, `stale` or `failed` it can be an earlier analysis of different answers. `null` when none is stored.",
      }),
    message: z.string().nullable().openapi({
      description:
        "Explanation for `stale`, `failed` or `unavailable`, otherwise `null`.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoSentimentAnalysisResponse", {
    description:
      "The stored AI analysis of what answers praise and criticize about the brand.",
  });

const changeStateSchema = z.object({
  mentioned: z.boolean().openapi({
    description: "Whether the answer mentioned the brand.",
  }),
  position: z.number().nullable().openapi({
    description:
      "1-based rank of the brand in a list of recommended brands, or `null` when it is not mentioned or not in a list.",
  }),
});

const changeScanSchema = z.object({
  id: z.string().openapi({ description: "Scan id." }),
  finishedAt: z.string().nullable().openapi({
    description:
      "ISO timestamp when the scan finished, or null when not recorded.",
  }),
});

export const geoChangesResponseSchema = z
  .object({
    previousScan: changeScanSchema.nullable().openapi({
      description:
        "Second most recently started completed scan, or `null` when the project has fewer than two completed scans. Without it there are no events.",
    }),
    currentScan: changeScanSchema.nullable().openapi({
      description:
        "Most recently started completed scan, or `null` when the project has none.",
    }),
    summary: z
      .object({
        gained: z.number().int().openapi({
          description: "Prompt and engine pairs that now mention the brand.",
        }),
        lost: z.number().int().openapi({
          description:
            "Pairs that no longer mention the brand, including those where a competitor took its place.",
        }),
        positionImproved: z.number().int().openapi({
          description: "Pairs where the brand moved up a list.",
        }),
        positionDropped: z.number().int().openapi({
          description:
            "Pairs where the brand moved down a list, including when a new competitor moved above it.",
        }),
        citationsAdded: z.number().int().openapi({
          description: "Pairs that now cite the project's own site.",
        }),
        citationsRemoved: z.number().int().openapi({
          description: "Pairs that no longer cite the project's own site.",
        }),
      })
      .openapi({
        description:
          "Counts over all events, including those beyond the returned `events`.",
      }),
    events: z
      .array(
        z.object({
          kind: z
            .enum([
              "gained_mention",
              "lost_mention",
              "position_improved",
              "position_dropped",
              "competitor_displaced",
              "citation_added",
              "citation_removed",
              "competitor_cited",
              "new_engine",
            ])
            .openapi({
              description:
                "Type of change, where competitor_displaced means competitors took the brand's place or moved above it, competitor_cited means competitor sites were newly cited and new_engine means the engine had no answer in the previous scan.",
            }),
          promptId: z.string().openapi({
            description:
              "ID of the tracked prompt, which is a custom prompt UUID or an auto prompt slug.",
          }),
          prompt: z.string().openapi({ description: "Prompt text." }),
          engine: z.string().openapi({
            description: "Answer engine id, as listed by listGeoEngines.",
          }),
          previous: changeStateSchema.nullable().openapi({
            description:
              "State in the previous scan, or `null` for `new_engine`.",
          }),
          current: changeStateSchema.openapi({
            description: "State in the current scan.",
          }),
          competitors: z.array(z.string()).openapi({
            description:
              "For `competitor_displaced`, the competitors that took the brand's place; for `competitor_cited`, competitors whose sites were newly cited. Otherwise empty.",
          }),
          domains: z.array(z.string()).openapi({
            description:
              "For `competitor_cited`, the newly cited competitor domains. Otherwise empty.",
          }),
        })
      )
      .openapi({
        description:
          "Changes per prompt and engine between the two scans, at most 40, ordered by kind, then engine, then prompt. Only answers to tracked prompts in the project's prompt language are compared.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoChangesResponse", {
    description:
      "What changed in brand mentions, positions and citations between the two latest completed scans.",
  });

export const geoPromptHistoryParamsSchema = projectParamsSchema.extend({
  promptId: z.string().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH).openapi({
    description:
      "Tracked prompt id from the prompts list: a custom prompt UUID or an auto prompt slug.",
  }),
});

export const geoPromptHistoryQuerySchema = z.object({
  scanId: z.string().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH).optional().openapi({
    description:
      "Only return answers from this scan. Defaults to the latest 120 answers across scans.",
  }),
});

export const geoPromptHistoryResponseSchema = z
  .object({
    configured: z.boolean().openapi({
      description: "Always `true` for a project-scoped request.",
    }),
    promptId: z.string().openapi({
      description: "The requested prompt id, echoed back.",
    }),
    checks: z
      .array(
        z.object({
          id: z.string().openapi({
            description:
              "Check id, usable with the prompt-result detail endpoint.",
          }),
          scanId: z
            .string()
            .openapi({ description: "Scan that captured the answer." }),
          engine: z.string().openapi({
            description: "Answer engine id, as listed by listGeoEngines.",
          }),
          mentioned: z.boolean().openapi({
            description: "Whether the answer mentioned the brand.",
          }),
          ownedSourceCited: z.boolean().optional().openapi({
            description:
              "Whether the answer cited a page on the project's own site.",
          }),
          position: z.number().nullable().openapi({
            description:
              "1-based rank of the brand in a list of recommended brands, or `null` when it is not mentioned or not in a list.",
          }),
          sentiment: z.string().nullable().openapi({
            description:
              "`positive`, `neutral` or `negative` toward the brand, or `null` when it is not mentioned or was not classified.",
          }),
          competitors: z.array(z.string()).openapi({
            description:
              "Competing brands the answer offered instead of the brand.",
          }),
          language: z.string().openapi({
            description:
              "Language the prompt was asked in, such as `English`. An empty string means English.",
          }),
          capturedAt: z.string().openapi({
            description: "ISO timestamp when the answer was captured.",
          }),
        })
      )
      .openapi({
        description:
          "Answers to this prompt, newest first. Without `scanId`, the latest 120 in the project's prompt language; with `scanId`, every answer from that scan.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPromptHistoryResponse", {
    description: "Past answers to one tracked prompt across engines and scans.",
  });

export { geoSentimentWindowQuerySchema as geoSentimentQuerySchema };
