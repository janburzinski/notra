import "zod/compile";
import { z } from "@hono/zod-openapi";

import { planBriefResponseSchema } from "./geo-content";
import {
  personaGenerationResponseSchema,
  runPersonaResponseSchema,
} from "./geo-personas";
import { runSequenceResponseSchema } from "./geo-sequences";

/** Successful payload returned by the dashboard's sequence-run adapter. */
export const internalGeoSequenceRunResponseSchema =
  runSequenceResponseSchema.omit({ organization: true });

/** Successful payload returned by the dashboard's writer-plan adapter. */
export const internalGeoWriterPlanResponseSchema = planBriefResponseSchema.omit(
  {
    organization: true,
  }
);

/** Successful payload returned by the dashboard's persona-run adapter. */
export const internalGeoPersonaRunResponseSchema =
  runPersonaResponseSchema.omit({ organization: true });

/** Successful payload returned by the dashboard's persona-generation adapter. */
export const internalGeoPersonaGenerationResponseSchema =
  personaGenerationResponseSchema.omit({ organization: true });

const remoteGeoFailureSchema = z.object({
  _tag: z.string().min(1),
  message: z.string().optional(),
  limit: z.number().optional(),
  status: z.string().optional(),
  reason: z.enum(["last_project", "has_sites"]).optional(),
});

/** Client-safe domain failure returned by an internal GEO adapter. */
export const remoteGeoFailureBodySchema = z.object({
  failure: remoteGeoFailureSchema,
});
