ALTER TABLE "linear_integrations" ADD COLUMN "encrypted_refresh_token" text;--> statement-breakpoint
ALTER TABLE "linear_integrations" ADD COLUMN "access_token_expires_at" timestamp;