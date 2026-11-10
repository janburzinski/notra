import "zod/compile";
import { TRAFFIC_EMBED_CHARTS } from "@notra/schemas/constants/dashboard/traffic-embed";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const TRAFFIC_EMBED_NAME_MAX_LENGTH = 80;
const TRAFFIC_EMBED_MAX_ORIGINS = 10;
const TRAFFIC_EMBED_ORIGIN_MAX_LENGTH = 253;
const TRAFFIC_EMBED_HOST_MAX_LENGTH = 253;

const embedOriginsSchema = z
  .array(z.string().trim().min(1).max(TRAFFIC_EMBED_ORIGIN_MAX_LENGTH))
  .min(1)
  .max(TRAFFIC_EMBED_MAX_ORIGINS);

/** At least one chart, each named once. */
const embedChartsSchema = z
  .array(z.enum(TRAFFIC_EMBED_CHARTS))
  .min(1)
  .max(TRAFFIC_EMBED_CHARTS.length)
  .refine((charts) => new Set(charts).size === charts.length, {
    message: "Each chart can only be listed once",
  });

const embedNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(TRAFFIC_EMBED_NAME_MAX_LENGTH);

export const listTrafficEmbedsInputSchema = z.object({
  organizationId: organizationIdSchema,
  projectId: z.string().min(1).optional(),
});

export const createTrafficEmbedInputSchema =
  listTrafficEmbedsInputSchema.extend({
    name: embedNameSchema,
    host: z.string().trim().max(TRAFFIC_EMBED_HOST_MAX_LENGTH).optional(),
    source: z.enum(["agents", "web"]).default("agents"),
    allowedOrigins: embedOriginsSchema,
    charts: embedChartsSchema.optional(),
  });

export const trafficEmbedInputSchema = z.object({
  organizationId: organizationIdSchema,
  embedId: z.string().min(1).max(64),
});

export const updateTrafficEmbedInputSchema = trafficEmbedInputSchema.extend({
  name: embedNameSchema,
  allowedOrigins: embedOriginsSchema,
  /** Omitted keeps the stored charts. */
  charts: embedChartsSchema.optional(),
});
