export const ANALYTICS_IMPORT_PROVIDERS = [
  "plausible",
  "plausible_csv",
  "vercel",
  "cloudflare",
  "cloudflare_rum",
  "rybbit",
  "databuddy",
] as const;

export const ANALYTICS_IMPORT_CONNECTION_PROVIDERS = [
  "plausible",
  "vercel",
  "cloudflare",
  "rybbit",
  "databuddy",
] as const;

export const ANALYTICS_IMPORT_CONNECTION_STATUSES = [
  "active",
  "reauth_required",
] as const;

export const ANALYTICS_IMPORT_KINDS = ["web", "geo"] as const;

export const ANALYTICS_IMPORT_STATUSES = [
  "pending",
  "running",
  "waiting_rate_limit",
  "completed",
  "failed",
  "deleting",
  "deleted",
] as const;

export const ANALYTICS_IMPORT_ACTIVE_STATUSES = [
  "pending",
  "running",
  "waiting_rate_limit",
] as const;

export const ANALYTICS_IMPORT_CHUNK_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
] as const;
