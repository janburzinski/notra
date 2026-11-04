import "zod/compile";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { githubPersonalAccessTokenSchema } from "@notra/schemas/dashboard/integrations";
import { isSameOriginPath } from "@notra/utils/auth-redirect";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

const GITHUB_INSTALLATION_ID_PATTERN = /^\d{1,20}$/;

const sameOriginPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isSameOriginPath, { message: "Must be a same-origin path" });

export const probeRepositoryInputSchema = z.object({
  owner: z.string().trim().min(1, "owner is required"),
  repo: z.string().trim().min(1, "repo is required"),
  token: githubPersonalAccessTokenSchema.optional(),
});

export const saveGitHubAppRepositoriesInputSchema =
  organizationIdInputSchema.extend({
    repositoryIds: z.array(z.string().min(1)).default([]),
    preserveExisting: z.boolean().default(false),
  });

export const disconnectGitHubAppInputSchema = organizationIdInputSchema.extend({
  accountId: z.string().min(1).optional(),
});

export const prepareInstallUrlInputSchema = organizationIdInputSchema.extend({
  callbackPath: z.string().trim().min(1, "Callback path is required"),
});

export const linkGitHubAppInstallationInputSchema =
  organizationIdInputSchema.extend({
    installationId: z
      .string()
      .regex(GITHUB_INSTALLATION_ID_PATTERN, "Invalid installation ID"),
  });

export const prepareGitHubAccountLinkInputSchema = z.object({
  /** Where to continue once the account is linked. */
  returnTo: sameOriginPathSchema,
  /** Page that shows the error if linking fails. */
  callbackPath: sameOriginPathSchema,
});

export const githubAccountLinkStateSchema =
  prepareGitHubAccountLinkInputSchema.extend({
    userId: z.string().min(1),
  });

export type PrepareInstallUrlInput = z.infer<
  typeof prepareInstallUrlInputSchema
>;
