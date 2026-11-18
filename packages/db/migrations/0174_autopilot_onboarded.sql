ALTER TABLE "autopilot_settings" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD COLUMN "onboarded_by" text;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD CONSTRAINT "autopilot_settings_onboarded_by_users_id_fk" FOREIGN KEY ("onboarded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Workspaces that already set Autopilot up count as onboarded, so turning it
-- off later shows the paused state instead of the setup chat again.
UPDATE "autopilot_settings" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;
