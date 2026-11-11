ALTER TABLE "autopilot_findings" ADD COLUMN "publish_at" timestamp;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ADD COLUMN "publish_hold_reason" text;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD COLUMN "approvals" jsonb DEFAULT '{"posts":"ask","updates":"ask","fixes":"ask"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD CONSTRAINT "autopilot_settings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;