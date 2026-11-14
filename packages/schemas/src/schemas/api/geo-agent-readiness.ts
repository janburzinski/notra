import "zod/compile";
import { z } from "@hono/zod-openapi";

import { organizationResponseSchema } from "./content";

const readinessTierSchema = z.object({
  earned: z.number().openapi({
    description: "Score points earned by the checks in this tier.",
  }),
  available: z.number().openapi({
    description: "Score points this tier can contribute.",
  }),
  passing: z.number().openapi({
    description: "Number of checks in this tier that passed.",
  }),
  total: z.number().openapi({
    description: "Number of checks in this tier.",
  }),
});

const readinessScoreBreakdownSchema = z.object({
  essential: readinessTierSchema,
  recommended: readinessTierSchema,
  bonus: z.object({
    points: z.number().openapi({
      description: "Extra score points earned from bonus signals.",
    }),
    positiveSignals: z.number().openapi({
      description: "Number of bonus signals detected.",
    }),
  }),
});

const readinessIssueSchema = z.object({
  id: z.string().openapi({
    description:
      "Stable check identifier, used to match the same check across scans.",
  }),
  name: z.string(),
  tier: z.enum(["essential", "recommended", "bonus"]),
  result: z.enum(["failed", "partial"]),
  details: z.string().nullable().openapi({
    description: "What the check found. Null when the scanner gave no details.",
  }),
  recommendation: z.string().nullable().openapi({
    description: "Suggested fix. Null when the scanner gave no recommendation.",
  }),
});

const readinessReportSchema = z
  .object({
    id: z.string(),
    status: z.enum(["running", "completed", "failed"]),
    targetUrl: z
      .string()
      .openapi({ description: "Website URL that was scanned." }),
    score: z.number().nullable().openapi({
      description:
        "Agent readiness score from 0 to 100. Null until the scan completes.",
    }),
    scoreLabel: z.string().nullable().openapi({
      description:
        "Label the Is Agentic scanner (is-agentic.com) gives the score, stored as returned. Its API defines it as free text, so treat it as display text rather than a fixed set of values. Null until the scan completes.",
    }),
    scoreBreakdown: readinessScoreBreakdownSchema.nullable().openapi({
      description:
        "Points and passing checks per tier. Null until the scan completes.",
    }),
    issues: z.array(readinessIssueSchema).openapi({
      description:
        "Checks that failed or only partly passed. Passing checks are not listed.",
    }),
    eligibleChecks: z.number().int().nullable().openapi({
      description:
        "Number of checks that applied to this website. Null until the scan completes.",
    }),
    errorMessage: z.string().nullable().openapi({
      description: "Why the scan failed. Null unless status is failed.",
    }),
    scannedAt: z.string().nullable().openapi({
      description:
        "ISO timestamp of when the website was scanned. Null until the scan completes.",
    }),
    createdAt: z.string(),
  })
  .openapi("GeoAgentReadinessReport");

const readinessHistoryPointSchema = z.object({
  id: z.string(),
  score: z.number().nullable().openapi({
    description: "Score from 0 to 100, or null when the scanner returned none.",
  }),
  failedCount: z.number().int().openapi({
    description: "Number of checks that failed in this scan.",
  }),
  partialCount: z.number().int().openapi({
    description: "Number of checks that only partly passed in this scan.",
  }),
  scannedAt: z.string().openapi({
    description:
      "ISO timestamp of the scan, or of when the report was created if the scan time is unknown.",
  }),
});

const readinessChangedCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["essential", "recommended", "bonus"]),
  previousResult: z.enum(["failed", "partial"]).nullable().openapi({
    description: "Result on the previous scan; null when the check passed.",
  }),
  result: z.enum(["failed", "partial"]).nullable().openapi({
    description: "Result on the latest scan; null when the check passes now.",
  }),
});

const readinessComparisonSchema = z.object({
  previousScore: z.number().nullable().openapi({
    description:
      "Score of the scan before the latest one, from 0 to 100. Null when the scanner returned none.",
  }),
  previousScannedAt: z.string().openapi({
    description: "ISO timestamp of the scan before the latest one.",
  }),
  resolved: z.array(readinessChangedCheckSchema).openapi({
    description: "Checks that had an issue before and pass now.",
  }),
  added: z.array(readinessChangedCheckSchema).openapi({
    description: "Checks that passed before and have an issue now.",
  }),
  improved: z.array(readinessChangedCheckSchema).openapi({
    description: "Checks that went from failed to partial.",
  }),
  worsened: z.array(readinessChangedCheckSchema).openapi({
    description: "Checks that went from partial to failed.",
  }),
});

export const agentReadinessResponseSchema = z
  .object({
    targetUrl: z.string().openapi({
      description:
        "Website URL from the project's brand identity that scans run against.",
    }),
    report: readinessReportSchema.nullable().openapi({
      description: "Latest completed report, if any.",
    }),
    scan: readinessReportSchema.nullable().openapi({
      description: "Latest run newer than the completed report, if any.",
    }),
    history: z.array(readinessHistoryPointSchema).openapi({
      description: "Up to the 60 most recent completed scans, oldest first.",
    }),
    comparison: readinessComparisonSchema.nullable().openapi({
      description:
        "Checks that changed between the latest completed scan and the one before it. Null until there are two completed scans.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoAgentReadinessResponse");

export const agentReadinessScanResponseSchema = z
  .object({
    reportId: z.string().openapi({
      description:
        "Id of the running report. Poll getGeoAgentReadiness until it appears as the completed report.",
    }),
    alreadyRunning: z.boolean().openapi({
      description:
        "True when an in-flight scan for the same URL was reused instead of starting a new one.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoAgentReadinessScanResponse");
