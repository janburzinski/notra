-- Additive: both columns are nullable or defaulted, so the running app keeps working.
ALTER TABLE "site_deployments" ADD COLUMN IF NOT EXISTS "config_mounts" jsonb;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "mounts_from_config" boolean DEFAULT false NOT NULL;
