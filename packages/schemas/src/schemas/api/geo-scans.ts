import "zod/compile";
import { z } from "@hono/zod-openapi";
import { GEO_MAX_ENGINES } from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema } from "./geo-fields";

const scanSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    status: z.enum(["running", "completed", "failed"]),
    startedAt: z.string(),
    finishedAt: z.string().nullable().openapi({
      description:
        "When the scan completed or failed, or `null` while running.",
    }),
    createdAt: z.string(),
    summary: z.object({
      plannedChecks: z.number().int().min(0).nullable().openapi({
        description:
          "Answers the scan planned to collect, or `null` when the scan recorded no plan.",
      }),
      completedChecks: z.number().int().min(0).openapi({
        description: "Answers stored for this scan so far.",
      }),
      mentionCount: z.number().int().min(0).openapi({
        description: "Stored answers that mentioned the tracked brand.",
      }),
      failedChecks: z.number().int().min(0).openapi({
        description: "Planned answers that failed and were not stored.",
      }),
      engines: z
        .array(
          z.object({
            engine: z.string(),
            plannedChecks: z.number().int().min(0).nullable().openapi({
              description:
                "Answers planned for this engine, or `null` when the plan has no per-engine breakdown.",
            }),
            completedChecks: z.number().int().min(0),
            mentionCount: z.number().int().min(0),
            failedChecks: z.number().int().min(0),
          })
        )
        .openapi({
          description:
            "The same counts per engine, sorted by engine id. Covers planned engines and engines with stored answers.",
        }),
    }),
    errorCode: z.string().nullable().openapi({
      description:
        "Machine-readable failure code such as `scan_handoff_failed` or `scan_stale`. `null` unless `status` is `failed`.",
    }),
    errorMessage: z.string().nullable().openapi({
      description:
        "Human-readable failure reason. `null` unless `status` is `failed`.",
    }),
    failedStage: z.enum(["handoff", "execution", "stale"]).nullable().openapi({
      description:
        "`handoff` when the scan could not be started, `execution` when it failed while running, `stale` when it stopped reporting progress and was closed. `null` unless `status` is `failed`.",
    }),
    retryable: z.boolean().nullable().openapi({
      description:
        "`true` when the failure was a timeout or a stale run, so starting a new scan is likely to work. `null` when unknown or the scan did not fail.",
    }),
  })
  .openapi("GeoScan");

export const listScansQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({ param: { name: "limit", in: "query" } }),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .openapi({ param: { name: "page", in: "query" } }),
});

const scanPaginationSchema = z.object({
  limit: z.number().int().min(1),
  currentPage: z.number().int().min(1),
  nextPage: z.number().int().min(1).nullable().openapi({
    description: "Next page number, or `null` on the last page.",
  }),
  previousPage: z.number().int().min(1).nullable().openapi({
    description: "Previous page number, or `null` on the first page.",
  }),
  totalPages: z.number().int().min(1).openapi({
    description: "Total pages at this `limit`. At least 1, even with no scans.",
  }),
  totalItems: z.number().int().min(0).openapi({
    description: "Total scans recorded for the project.",
  }),
});

export const listScansResponseSchema = z
  .object({
    scans: z.array(scanSchema).openapi({
      description: "Scans for the project, most recently started first.",
    }),
    pagination: scanPaginationSchema,
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoScansResponse");

export const scanResponseSchema = z
  .object({
    scan: scanSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoScanResponse");

export const createPromptScanRequestSchema = z
  .object({
    oneShot: z.boolean().optional().openapi({
      description:
        "Run once even when brand tracking is paused, without enabling or advancing the schedule or automatically retrying the scan.",
    }),
    engines: z
      .array(createGeoShortTextSchema())
      .min(1)
      .max(GEO_MAX_ENGINES)
      .optional()
      .openapi({
        description:
          "Run only these engines, using ids from `GET /v1/projects/{projectId}/geo/engines`, for example `[\"openai/chatgpt\"]` for one engine. An engine the project doesn't track can be tried once without tracking it. Omit to run every tracked engine. An unknown id is rejected with a 400. A scan that leaves out tracked engines doesn't count as the project's scheduled scan.",
        example: ["openai/chatgpt"],
      }),
  })
  .openapi("CreateGeoPromptScanRequest");

export const createScanRequestSchema = createPromptScanRequestSchema
  .extend({
    includeSequences: z.boolean().optional().openapi({
      description:
        "Defaults to true. Set to false to omit multi-turn sequences without changing project settings. Persona checks are unaffected.",
    }),
  })
  .openapi("CreateGeoScanRequest");

/**
 * The scan row is created before the workflow is handed off, so the id here is
 * the one `GET /v1/projects/{projectId}/geo/scans/{scanId}` already answers
 * for. The workflow's own run id is deliberately not exposed: it never mapped
 * to a scan a client could read, which made polling a race.
 */
export const createScanResponseSchema = z
  .object({
    scanId: z.string().openapi({
      description:
        "Id of the queued scan, readable right away via `GET /v1/projects/{projectId}/geo/scans/{scanId}`.",
    }),
    statusUrl: z.string().openapi({
      description:
        "Relative URL of that scan, also sent as the `Location` header. Poll it until `status` leaves `running`.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("CreateGeoScanResponse");
