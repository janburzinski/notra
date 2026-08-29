ALTER TABLE "geo_scans" ADD COLUMN "successful_checks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_scans" ADD COLUMN "failed_checks" integer DEFAULT 0 NOT NULL;