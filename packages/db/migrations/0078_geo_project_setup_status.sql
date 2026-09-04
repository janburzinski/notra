ALTER TABLE "projects" ADD COLUMN "setup_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "setup_error" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "setup_attempt_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "setup_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "geo_scans" ADD COLUMN "handoff_claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "geo_scans" ADD COLUMN "handoff_status" text;--> statement-breakpoint
ALTER TABLE "geo_agent_readiness_reports" ADD COLUMN "execution_started_at" timestamp;
