import {
  decryptToken,
  encryptToken,
} from "@notra/db/utils/integration-encryption";
import {
  cloudflareCredentialsSchema,
  databuddyCredentialsSchema,
  plausibleCredentialsSchema,
  rybbitCredentialsSchema,
  vercelCredentialsSchema,
} from "@notra/geo-core/schemas/analytics-imports";

import type {
  AnalyticsImportCredentials,
  AnalyticsImportSecretInput,
} from "@/types/analytics-imports";

export function encryptImportCredentials(
  credentials: AnalyticsImportCredentials
): string {
  return encryptToken(JSON.stringify(credentials));
}

/** Decrypts and re-validates; a tampered or stale payload throws. */
export function decryptImportCredentials(
  encrypted: string
): AnalyticsImportCredentials {
  const value: unknown = JSON.parse(decryptToken(encrypted));
  const provider =
    value && typeof value === "object" && "provider" in value
      ? value.provider
      : null;
  switch (provider) {
    case "plausible":
      return { provider, ...plausibleCredentialsSchema.parse(value) };
    case "cloudflare":
      return { provider, ...cloudflareCredentialsSchema.parse(value) };
    case "vercel":
      return { provider, ...vercelCredentialsSchema.parse(value) };
    case "rybbit":
      return { provider, ...rybbitCredentialsSchema.parse(value) };
    case "databuddy":
      return { provider, ...databuddyCredentialsSchema.parse(value) };
    default:
      throw new Error("Unknown analytics import credentials");
  }
}

export function toImportCredentials(
  input: AnalyticsImportSecretInput
): AnalyticsImportCredentials {
  switch (input.provider) {
    case "plausible":
      return {
        provider: "plausible",
        ...plausibleCredentialsSchema.parse({ apiKey: input.secret }),
      };
    case "cloudflare":
      return {
        provider: "cloudflare",
        ...cloudflareCredentialsSchema.parse({ apiToken: input.secret }),
      };
    case "rybbit":
      return {
        provider: "rybbit",
        ...rybbitCredentialsSchema.parse({ apiKey: input.secret }),
      };
    case "databuddy":
      return {
        provider: "databuddy",
        ...databuddyCredentialsSchema.parse({ apiKey: input.secret }),
      };
    default:
      return {
        provider: "vercel",
        ...vercelCredentialsSchema.parse({
          token: input.secret,
          ...(input.teamId ? { teamId: input.teamId } : {}),
        }),
      };
  }
}
