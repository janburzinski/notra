-- Additive: the running app never writes the new trigger or reads the column.
ALTER TABLE "site_deployments" ADD COLUMN IF NOT EXISTS "render_fingerprint" text;--> statement-breakpoint
ALTER TABLE "site_deployments" DROP CONSTRAINT IF EXISTS "siteDeployments_trigger_check";--> statement-breakpoint
ALTER TABLE "site_deployments" ADD CONSTRAINT "siteDeployments_trigger_check" CHECK ("site_deployments"."trigger" IN ('push', 'pull_request', 'manual', 'redeploy', 'config', 'toolchain'));
