import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_BRIEF_MAX_CHECKLIST,
  GEO_BRIEF_MAX_CLAIMS,
  GEO_BRIEF_MAX_LINKS,
  GEO_BRIEF_MAX_QUESTIONS,
  GEO_BRIEF_MAX_SECTIONS,
  GEO_BRIEF_MAX_TITLE_LENGTH,
  GEO_BRIEF_MIN_SECTIONS,
} from "@notra/ai/constants/geo-writer";
import { BLOG_POST_SUBTYPES } from "@notra/db/constants/content";
import {
  GEO_CONTENT_BRIEF_STATUSES,
  GEO_WRITER_SOURCE_KINDS,
} from "@notra/db/constants/geo-writer";
import {
  GEO_EXISTING_PAGE_URL_MAX_LENGTH,
  GEO_MAX_COMPETITORS,
} from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { projectParamsSchema } from "./geo-params";
import { resourceIdSchema } from "./ids";

const GEO_BRIEF_TOPIC_MIN_LENGTH = 3;
const GEO_BRIEF_TOPIC_MAX_LENGTH = 200;
const GEO_BRIEF_MAX_BRAND_VOICES = 8;

const gapBriefBaselineSchema = z.object({
  mentionedEngines: z.number().openapi({
    description: "Engines that mentioned the brand when the brief was planned.",
  }),
  totalEngines: z.number().openapi({
    description: "Engines checked when the brief was planned.",
  }),
});

const gapBriefRefSchema = z
  .object({
    briefId: z.string().openapi({
      description: "Use with getGeoContentBrief and approveGeoContentBrief.",
    }),
    status: z.enum(GEO_CONTENT_BRIEF_STATUSES),
    postId: z.string().nullable().openapi({
      description:
        "Draft post created for the brief. Null when none is linked.",
    }),
    workingTitle: z.string().nullable(),
    publishedAt: z.string().nullable().openapi({
      description:
        "ISO timestamp of when the brief's post was published. Null until then.",
    }),
    baseline: gapBriefBaselineSchema.nullable().openapi({
      description:
        "Engine coverage captured when the brief was planned, to compare against after publishing. Only set for briefs planned from a prompt gap or prompt with scan results from the last 30 days; null otherwise.",
    }),
    rescanned: z.boolean().openapi({
      description:
        "True once a rescan of the source prompt was started after the post was published.",
    }),
  })
  .openapi({
    description:
      "The most recently updated brief planned from this gap. Null when none exists.",
  });

const searchGapTargetSchema = z.object({
  kind: z.enum(["page", "post"]).openapi({
    description: "page: a page from the brand's sitemap; post: a Notra post.",
  }),
  id: z.string().openapi({
    description:
      "Sitemap page id or post id. For a Google-ranked page Notra has not crawled, the page URL.",
  }),
  url: z.string().nullable(),
  title: z.string(),
  score: z.number().openapi({
    description:
      "How much of the gap's terms this page already covers, from 0 to 1.",
  }),
  googlePosition: z.number().optional().openapi({
    description:
      "Google position of the gap's queries on this page, when Search Console shows it already ranks there.",
  }),
});

const searchGapRecommendationSchema = z.object({
  action: z.enum(["create", "update", "merge", "ignore"]).openapi({
    description:
      "What to do with this query cluster: create a new page, update the page Google already ranks or the strongest existing page, merge overlapping pages, or ignore thin demand.",
  }),
  reason: z.string().openapi({
    description: "Plain-language explanation of the recommended action.",
  }),
  targets: z.array(searchGapTargetSchema).openapi({
    description:
      "Existing pages to update or merge, best match first. For create, the closest existing page when there is one; empty for ignore.",
  }),
});

const promptGapSchema = z.object({
  id: z.string().openapi({
    description:
      "Tracked prompt id, or the scan prompt id for prompts that are not tracked. Use as promptId with updateGeoContentGap, or as sourceId with sourceKind gap when planning a brief.",
  }),
  prompt: z.string(),
  title: z.string().nullable(),
  engines: z.array(z.string()).openapi({
    description:
      "Engines whose latest answer from the last 30 days did not mention the brand.",
  }),
  mentionedEngines: z.array(z.string()).openapi({
    description:
      "Engines whose latest answer from the last 30 days mentioned the brand.",
  }),
  competitors: z.array(z.string()).openapi({
    description:
      "Tracked competitors named in answers that left out the brand.",
  }),
  discoveredCompetitors: z.array(z.string()).openapi({
    description:
      "Other brands named in answers that left out the brand and are not tracked as competitors.",
  }),
  searchQueries: z.array(z.string()).openapi({
    description: "Web searches AI engines ran while answering this prompt.",
  }),
  ownMentionRate: z.number().openapi({
    description:
      "Share of checked engines that mentioned the brand, from 0 to 1.",
  }),
  engineCoverage: z.number().openapi({
    description: "Number of engines with an answer for this prompt.",
  }),
  opportunity: z.number().openapi({
    description:
      "Relative priority: grows with missing mentions, engines checked and competitors named. Gaps are sorted by it, highest first; 0 when won.",
  }),
  won: z.boolean().openapi({
    description:
      "True when most engines now mention the brand; the gap stays listed because a brief was planned for it.",
  }),
  brief: gapBriefRefSchema.nullable(),
  recommendation: searchGapRecommendationSchema.optional().openapi({
    description:
      "Whether to create a page or work on existing ones, from how well the brand's sitemap pages and posts already cover the prompt and its web searches. Never ignore, since prompt gaps carry no Search Console demand. Missing on snapshots built before it was added.",
  }),
});

const searchGapSchema = z.object({
  id: z.string().openapi({
    description:
      "Search Console prompt suggestion id. Use as sourceId with sourceKind search_console when planning a brief.",
  }),
  prompt: z.string().openapi({ description: "Suggested prompt." }),
  title: z.string().nullable(),
  impressions: z.number().nullable().openapi({
    description:
      "Google impressions summed across the queries. Null when no query data is stored.",
  }),
  clicks: z.number().nullable().openapi({
    description:
      "Google clicks summed across the queries. Null when no query data is stored.",
  }),
  position: z.number().nullable().openapi({
    description:
      "Impression-weighted average Google position across the queries, rounded to one decimal. Null when no query data is stored.",
  }),
  queries: z.array(
    z.object({
      query: z.string(),
      clicks: z.number(),
      impressions: z.number(),
      position: z.number(),
      page: z.string().optional().openapi({
        description: "Page Google showed most for this query.",
      }),
      pagePosition: z.number().optional().openapi({
        description: "Google position of that page for this query.",
      }),
      pageImpressions: z.number().optional().openapi({
        description: "Impressions of that page for this query.",
      }),
    })
  ),
  brief: gapBriefRefSchema.nullable(),
  recommendation: searchGapRecommendationSchema,
});

const aiSearchGapSchema = z.object({
  id: z.string().openapi({
    description:
      "Use as sourceId with sourceKind ai_search when planning a brief.",
  }),
  query: z.string().openapi({
    description: "Most common wording of the web search.",
  }),
  variants: z.array(z.string()).openapi({
    description: "Other wordings of the same search.",
  }),
  prompts: z.array(z.string()).openapi({
    description: "Prompt texts whose answers ran this search.",
  }),
  engines: z.array(z.string()).openapi({
    description:
      "Engines that ran this search without mentioning the brand or citing its site.",
  }),
  searches: z.number().openapi({
    description:
      "Scan answers in which an engine ran this web search without mentioning the brand or citing its site.",
  }),
  ownMentionRate: z.number().openapi({
    description:
      "Share of answers that ran this search and still mentioned the brand or cited its site, from 0 to 1.",
  }),
  competitors: z.array(z.string()).openapi({
    description:
      "Tracked competitors named in the answers that missed the brand.",
  }),
  discoveredCompetitors: z.array(z.string()).openapi({
    description:
      "Other brands named in the answers that missed the brand and are not tracked as competitors.",
  }),
  opportunity: z.number().openapi({
    description:
      "Relative priority: grows with missing mentions, searches and competitors named. Sorted highest first.",
  }),
  brief: gapBriefRefSchema.nullable(),
});

export const contentGapsResponseSchema = z
  .object({
    promptGaps: z.array(promptGapSchema).openapi({
      description:
        "Prompts where at least half of the engines answering in the last 30 days left out the brand, plus won gaps that have a brief, highest opportunity first. Ignored gaps are excluded.",
    }),
    searchGaps: z.array(searchGapSchema).openapi({
      description:
        "Pending prompt suggestions from Google Search Console queries. Clicks, impressions and positions are from the Search Console data covering 31 to 3 days before the suggestion was generated, and are not refreshed later.",
    }),
    aiSearchGaps: z.array(aiSearchGapSchema).openapi({
      description:
        "Web searches AI engines ran in scan answers without mentioning the brand or citing its site.",
    }),
    hasScanData: z.boolean().openapi({
      description: "False until the project has at least one scan result.",
    }),
    snapshotReady: z.boolean().openapi({
      description:
        "False while the project's content gaps snapshot is being prepared.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoContentGapsResponse");

export const updateGapRequestSchema = z
  .object({
    ignored: z.boolean().openapi({
      description:
        "true hides the prompt gap from content gaps and brief planning; false brings it back.",
    }),
  })
  .openapi("UpdateGeoContentGapRequest");

export const updateGapResponseSchema = z
  .object({
    promptId: z.string(),
    ignored: z.boolean(),
    organization: organizationResponseSchema,
  })
  .openapi("UpdateGeoContentGapResponse");

export const briefParamsSchema = projectParamsSchema.extend({
  briefId: resourceIdSchema("briefId").openapi({
    param: { name: "briefId", in: "path" },
  }),
});

const briefSectionSchema = z.object({
  heading: z.string().openapi({ description: "H2 heading for the section." }),
  goal: z.string().openapi({
    description: "One sentence on what the reader should take away.",
  }),
  claims: z.array(z.string()).openapi({
    description: `Up to ${GEO_BRIEF_MAX_CLAIMS} concrete, checkable claims the section must make.`,
  }),
});

const briefInternalLinkSchema = z.object({
  url: z.string().openapi({
    description:
      "Brand page to link. The planner is told to copy it from the project's sitemap; Notra does not check it.",
  }),
  anchor: z.string().openapi({ description: "Anchor text for the link." }),
  why: z.string().openapi({
    description: "Why the page belongs in the article.",
  }),
});

const briefDocumentSchema = z
  .object({
    targetPrompt: z.string().openapi({
      description: "The AI assistant prompt the article is written to win.",
    }),
    intent: z.string().openapi({
      description: "Search intent behind the target prompt.",
    }),
    contentSubtype: z.enum(BLOG_POST_SUBTYPES).openapi({
      description: "Kind of blog post to write.",
    }),
    workingTitle: z.string().openapi({
      description: `Planned article title, up to ${GEO_BRIEF_MAX_TITLE_LENGTH} characters.`,
    }),
    audience: z.string().openapi({ description: "Who the article is for." }),
    jobToBeDone: z.string().openapi({
      description: "What the reader is trying to get done.",
    }),
    sections: z.array(briefSectionSchema).openapi({
      description: `The outline, ${GEO_BRIEF_MIN_SECTIONS} to ${GEO_BRIEF_MAX_SECTIONS} sections in order.`,
    }),
    questionsToAnswer: z.array(z.string()).openapi({
      description: `Up to ${GEO_BRIEF_MAX_QUESTIONS} questions the article's FAQ must answer directly.`,
    }),
    internalLinks: z.array(briefInternalLinkSchema).openapi({
      description: `Up to ${GEO_BRIEF_MAX_LINKS} links to the brand's own pages, picked from the project's sitemap pages.`,
    }),
    acceptanceChecklist: z.array(z.string()).openapi({
      description: `Up to ${GEO_BRIEF_MAX_CHECKLIST} checks the finished article must pass, based on Notra's GEO writing rules.`,
    }),
    recommendedAngle: z.string().optional().openapi({
      description:
        "Why this article should earn the mention, based on current AI answers. Only filled when the brief was planned from scan evidence.",
    }),
    competitorsToCounter: z.array(z.string()).optional().openapi({
      description:
        "Brands named in current AI answers and the claims that earned them the mention. Only filled when the brief was planned from scan evidence.",
    }),
    sourcesToReference: z.array(z.string()).optional().openapi({
      description:
        "Domains cited in current AI answers. Only filled when the brief was planned from scan evidence.",
    }),
    missingCoverage: z.array(z.string()).optional().openapi({
      description:
        "Facts or topics winning AI answers covered that the brand must now cover. Only filled when the brief was planned from scan evidence.",
    }),
    baseline: z
      .object({
        sourcePromptId: z.string().openapi({
          description: "Prompt id the brief was planned from.",
        }),
        mentionedEngines: z.number().openapi({
          description: "Engines whose latest answer mentioned the brand.",
        }),
        totalEngines: z.number().openapi({
          description: "Engines with an answer in the last 30 days.",
        }),
        engines: z
          .array(
            z.object({
              engine: z.string(),
              mentioned: z.boolean(),
              position: z.number().nullable().openapi({
                description:
                  "Position of the brand in the answer. Null when the answer gave it none.",
              }),
            })
          )
          .openapi({ description: "Latest answer per engine." }),
        competitorMentions: z
          .array(z.object({ name: z.string(), engines: z.number() }))
          .openapi({
            description:
              "Competitors named in the answers, with the number of engines naming each.",
          }),
        citedDomains: z
          .array(z.object({ domain: z.string(), engines: z.number() }))
          .openapi({
            description:
              "Domains cited in the answers, with the number of engines citing each.",
          }),
        capturedAt: z.string().nullable().openapi({
          description: "ISO timestamp of the newest answer used.",
        }),
      })
      .nullable()
      .optional()
      .openapi({
        description:
          "How AI engines answered the source prompt when the brief was planned, from answers in the last 30 days. Only set for briefs planned from a prompt gap or prompt; null when there were no recent answers.",
      }),
  })
  .openapi("GeoContentBriefDocument", {
    description:
      "The article plan. Notra's AI planner writes the text fields; updateGeoContentBrief can change them.",
  });

const briefSummarySchema = z
  .object({
    id: z.string(),
    topic: z.string(),
    workingTitle: z.string(),
    status: z.enum(GEO_CONTENT_BRIEF_STATUSES),
    postId: z.string().nullable().openapi({
      description:
        "Post the brief writes into. Null when no post is linked, for example after it was deleted.",
    }),
    createdAt: z.string(),
  })
  .openapi("GeoContentBriefSummary");

export const listBriefsResponseSchema = z
  .object({
    briefs: z.array(briefSummarySchema).openapi({
      description:
        "The project's 20 most recently created briefs, newest first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoContentBriefsResponse");

const briefDetailSchema = z
  .object({
    id: z.string(),
    topic: z.string(),
    brief: briefDocumentSchema,
    status: z.enum(GEO_CONTENT_BRIEF_STATUSES),
    autoApproved: z.boolean().openapi({
      description:
        "True when writing started automatically at planning time instead of through approval.",
    }),
    runId: z.string().nullable().openapi({
      description: "Latest writer run id. Null until the brief is approved.",
    }),
    postId: z.string().nullable().openapi({
      description:
        "Post the brief writes into. Null when no post is linked, for example after it was deleted.",
    }),
    humanized: z.boolean().openapi({
      description:
        "True when the writer's humanizing pass rewrote the draft post.",
    }),
    error: z.string().nullable().openapi({
      description: "Why the last writer run failed. Null otherwise.",
    }),
    createdAt: z.string(),
    updatedAt: z.string().openapi({
      description:
        "Pass as expectedUpdatedAt to updateGeoContentBrief to avoid overwriting newer changes.",
    }),
    completedAt: z.string().nullable().openapi({
      description:
        "ISO timestamp of when the last writer run finished or failed. Null while writing or before approval.",
    }),
  })
  .openapi("GeoContentBriefDetail");

export const briefResponseSchema = z
  .object({
    brief: briefDetailSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoContentBriefResponse");

export const planBriefRequestSchema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(GEO_BRIEF_TOPIC_MIN_LENGTH)
      .max(GEO_BRIEF_TOPIC_MAX_LENGTH)
      .openapi({
        description:
          "What the article should target. Replaced by the source prompt when sourceKind is gap, prompt or search_console.",
      }),
    autoApprove: z.boolean().default(false).openapi({
      description:
        "Start the writer immediately instead of leaving the brief in draft.",
    }),
    contentSubtype: z.enum(BLOG_POST_SUBTYPES).optional(),
    brandVoiceIds: z
      .array(resourceIdSchema("brandVoiceId"))
      .max(GEO_BRIEF_MAX_BRAND_VOICES)
      .optional()
      .openapi({
        description:
          "Only the first entry is used; it overrides the project's brand identity.",
      }),
    competitorIds: z
      .array(resourceIdSchema("competitorId"))
      .max(GEO_MAX_COMPETITORS)
      .optional(),
    sitemapId: resourceIdSchema("sitemapId").optional(),
    sourceKind: z.enum(GEO_WRITER_SOURCE_KINDS).optional(),
    sourceId: z.string().min(1).optional().openapi({
      description:
        "Gap, prompt or search-console suggestion id. An open brief for the same source is reused instead of planning a new one.",
    }),
    existingPageUrl: z
      .url()
      .max(GEO_EXISTING_PAGE_URL_MAX_LENGTH)
      .optional()
      .openapi({
        description:
          "Existing page the article should refresh instead of creating a competing page.",
      }),
  })
  .openapi("PlanGeoContentBriefRequest");

const briefLineSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[^\r\n]*$/, "Must be a single line");

export const updateBriefRequestSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime().optional().openapi({
      description:
        "The brief's updatedAt from your last read. When set, the update fails with 409 if the brief changed since. Omit to overwrite the latest version.",
    }),
    workingTitle: briefLineSchema.max(GEO_BRIEF_MAX_TITLE_LENGTH).optional(),
    targetPrompt: briefLineSchema.optional(),
    intent: briefLineSchema.optional(),
    audience: briefLineSchema.optional(),
    jobToBeDone: briefLineSchema.optional(),
    sections: z
      .array(
        z.object({
          heading: briefLineSchema,
          goal: briefLineSchema,
          claims: z.array(briefLineSchema).max(GEO_BRIEF_MAX_CLAIMS),
        })
      )
      .min(GEO_BRIEF_MIN_SECTIONS)
      .max(GEO_BRIEF_MAX_SECTIONS)
      .optional()
      .openapi({
        description:
          "The outline. Replaces every section; send the full list in order.",
      }),
    questionsToAnswer: z
      .array(briefLineSchema)
      .max(GEO_BRIEF_MAX_QUESTIONS)
      .optional()
      .openapi({ description: "FAQ questions. Replaces the whole list." }),
    internalLinks: z
      .array(
        z.object({
          url: briefLineSchema,
          anchor: briefLineSchema,
          why: briefLineSchema,
        })
      )
      .max(GEO_BRIEF_MAX_LINKS)
      .optional()
      .openapi({ description: "Replaces the whole list." }),
    acceptanceChecklist: z
      .array(briefLineSchema)
      .max(GEO_BRIEF_MAX_CHECKLIST)
      .optional()
      .openapi({ description: "Replaces the whole list." }),
  })
  .refine(
    ({ expectedUpdatedAt: _, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: "Provide at least one field to update" }
  )
  .openapi("UpdateGeoContentBriefRequest");

export const planBriefResponseSchema = z
  .object({
    briefId: z.string().openapi({
      description:
        "New brief id, or the id of an open brief reused for the same source.",
    }),
    brief: briefDocumentSchema,
    status: z.enum(GEO_CONTENT_BRIEF_STATUSES),
    runId: z.string().nullable().openapi({
      description:
        "Writer run id. Null when no writer run has started for the brief.",
    }),
    postId: z.string().nullable().openapi({
      description: "Draft post the writer fills in. Null when none is linked.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("PlanGeoContentBriefResponse");

export const approveBriefResponseSchema = z
  .object({
    runId: z.string().openapi({
      description:
        "Writer run started for the brief. Poll getGeoContentBrief for status and postId.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ApproveGeoContentBriefResponse");
