import {
  ANALYTICS_IMPORT_CONNECTION_PROVIDERS,
  ANALYTICS_IMPORT_PROVIDERS,
} from "@notra/db/constants/analytics-imports";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
import z from "zod";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const projectIdSchema = z.string().min(1).max(64);
const hostSchema = z.string().trim().min(3).max(253);

/** Days another source already has for the domain: skip them (the default) or add both counts. */
const analyticsImportOverlapSchema = z.enum(["skip", "add"]).default("skip");

const analyticsImportApiProviderSchema = z.enum(
  ANALYTICS_IMPORT_CONNECTION_PROVIDERS
);

const analyticsImportSourceProviderSchema = z
  .enum(ANALYTICS_IMPORT_PROVIDERS)
  .exclude(["plausible_csv"]);

export const listAnalyticsImportsInputSchema = z.object({
  organizationId: organizationIdSchema,
  projectId: projectIdSchema.nullish(),
});

export const connectAnalyticsImportInputSchema = z.object({
  organizationId: organizationIdSchema,
  provider: analyticsImportApiProviderSchema,
  secret: z.string().trim().min(10).max(500),
  teamId: z
    .string()
    .trim()
    .regex(/^team_[A-Za-z0-9]+$/)
    .optional(),
  label: z.string().trim().max(80).optional(),
  /** Replaces the key of this saved connection instead of adding one. */
  connectionId: z.string().min(1).max(64).optional(),
});

export const analyticsImportConnectionInputSchema = z.object({
  organizationId: organizationIdSchema,
  connectionId: z.string().min(1).max(64),
});

export const disconnectAnalyticsImportInputSchema =
  analyticsImportConnectionInputSchema.extend({
    deleteImports: z.boolean().default(false),
  });

export const analyticsImportSourceInputSchema =
  analyticsImportConnectionInputSchema.extend({
    projectId: projectIdSchema,
    provider: analyticsImportSourceProviderSchema,
    sourceRef: z.string().min(1).max(200),
    sourceLabel: z.string().max(200),
    host: hostSchema,
    startDay: daySchema.optional(),
    endDay: daySchema.optional(),
    overlap: analyticsImportOverlapSchema,
  });

export const analyticsImportUploadInputSchema = z.object({
  organizationId: organizationIdSchema,
  fileSize: z.number().int().positive(),
});

export const analyticsImportCsvInputSchema = z.object({
  organizationId: organizationIdSchema,
  projectId: projectIdSchema,
  host: hostSchema,
  uploadKey: z.string().min(1).max(300).optional(),
  file: z.instanceof(Blob).optional(),
  /** Only validate and preview; nothing is stored. */
  previewOnly: z.boolean().default(false),
  overlap: analyticsImportOverlapSchema,
});

export const deleteAnalyticsImportInputSchema = z.object({
  organizationId: organizationIdSchema,
  importId: z.string().min(1).max(64),
});
